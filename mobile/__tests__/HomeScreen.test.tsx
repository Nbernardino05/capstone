import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import HomeScreen from '../src/screens/HomeScreen';

// Module mocks
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

let mockMedications: any[] = [];
jest.mock('../src/context/OnboardingContext', () => ({
  useOnboarding: () => ({
    patientId: 1,
    medications: mockMedications,
  }),
}));

const mockLogDose = jest.fn();
const mockGetTodayLogs = jest.fn();
jest.mock('../src/api/medications', () => ({
  logDose: (...args: any[]) => mockLogDose(...args),
  getTodayLogs: (...args: any[]) => mockGetTodayLogs(...args),
}));

// Helpers
const baseMed = {
  id: 1,
  patient_id: 1,
  name: 'Metformin',
  dosage: '500',
  dosage_metric: 'mg',
  frequency_when: 'once',
  frequency_period: 'daily',
  source: 'provider',
  status: 'active',
};

function makeLog(medicationId: number, minutesAgo: number) {
  return {
    id: 1,
    patient_id: 1,
    medication_id: medicationId,
    logged_at: new Date(Date.now() - minutesAgo * 60 * 1000).toISOString(),
  };
}

// Setup
beforeEach(() => {
  jest.clearAllMocks();
  mockMedications = [];
  mockGetTodayLogs.mockResolvedValue([]);
});

// Tests (US 14)
describe('HomeScreen — US 14: Log Medication Doses', () => {
  // Initial load
  it("fetches today's logs for the patient on mount", async () => {
    render(<HomeScreen />);
    await waitFor(() => {
      expect(mockGetTodayLogs).toHaveBeenCalledWith(1);
    });
  });

  it('shows the empty state when there are no active medications', async () => {
    mockMedications = [];
    render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.getByText('No medications added yet')).toBeTruthy();
    });
  });

  it('displays the name of each active medication', async () => {
    mockMedications = [baseMed];
    render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.getByText('Metformin')).toBeTruthy();
    });
  });

  it('does not display inactive medications', async () => {
    mockMedications = [{ ...baseMed, status: 'inactive' }];
    render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.queryByText('Metformin')).toBeNull();
    });
  });

  // Skip (dismiss)
  it('removes a medication from the list when the skip button is pressed', async () => {
    mockMedications = [baseMed];
    render(<HomeScreen />);
    await waitFor(() => screen.getByLabelText('Skip dose'));

    fireEvent.press(screen.getByLabelText('Skip dose'));

    await waitFor(() => {
      expect(screen.queryByText('Metformin')).toBeNull();
    });
  });

  // Log a dose
  it('calls logDose with the patient and medication ids when the log button is pressed', async () => {
    mockMedications = [baseMed];
    mockLogDose.mockResolvedValueOnce(makeLog(1, 0));

    render(<HomeScreen />);
    await waitFor(() => screen.getByLabelText('Log dose'));
    fireEvent.press(screen.getByLabelText('Log dose'));

    await waitFor(() => {
      expect(mockLogDose).toHaveBeenCalledWith(1, 1);
    });
  });

  // Regular medications
  it('hides log and skip buttons after a regular medication is logged', async () => {
    mockMedications = [baseMed];
    mockLogDose.mockResolvedValueOnce(makeLog(1, 0));

    render(<HomeScreen />);
    await waitFor(() => screen.getByLabelText('Log dose'));
    fireEvent.press(screen.getByLabelText('Log dose'));

    await waitFor(() => {
      expect(screen.queryByLabelText('Log dose')).toBeNull();
      expect(screen.queryByLabelText('Skip dose')).toBeNull();
    });
  });

  it('shows a logged time label after a regular medication is logged', async () => {
    mockMedications = [baseMed];
    mockLogDose.mockResolvedValueOnce(makeLog(1, 0));

    render(<HomeScreen />);
    await waitFor(() => screen.getByLabelText('Log dose'));
    fireEvent.press(screen.getByLabelText('Log dose'));

    await waitFor(() => {
      expect(screen.getByText(/✓ Logged/)).toBeTruthy();
    });
  });

  it('restores the logged state on mount when today logs already exist for a regular med', async () => {
    mockMedications = [baseMed];
    // A log from 2 hours ago (outside 30-min window — irrelevant for regular meds)
    mockGetTodayLogs.mockResolvedValueOnce([makeLog(1, 120)]);

    render(<HomeScreen />);

    await waitFor(() => {
      // Buttons should be hidden because the med was already logged today
      expect(screen.queryByLabelText('Log dose')).toBeNull();
      expect(screen.getByText(/✓ Logged/)).toBeTruthy();
    });
  });

  // As-needed medications
  it('keeps log and skip buttons visible after logging an as-needed medication', async () => {
    mockMedications = [{ ...baseMed, frequency_when: 'as_needed' }];
    // Log from 1 hour ago so no duplicate alert
    mockLogDose.mockResolvedValueOnce(makeLog(1, 60));

    render(<HomeScreen />);
    await waitFor(() => screen.getByLabelText('Log dose'));
    fireEvent.press(screen.getByLabelText('Log dose'));

    await waitFor(() => {
      expect(screen.getByLabelText('Log dose')).toBeTruthy();
      expect(screen.getByLabelText('Skip dose')).toBeTruthy();
    });
  });

  it('shows a duplicate-dose alert when an as-needed med was logged within the last 30 minutes', async () => {
    mockMedications = [{ ...baseMed, frequency_when: 'as_needed' }];
    mockGetTodayLogs.mockResolvedValueOnce([makeLog(1, 5)]); // logged 5 min ago

    const alertSpy = jest.spyOn(Alert, 'alert');

    render(<HomeScreen />);
    await waitFor(() => screen.getByLabelText('Log dose'));
    fireEvent.press(screen.getByLabelText('Log dose'));

    expect(alertSpy).toHaveBeenCalledWith(
      '',
      'You already logged a dose recently. Log another?',
      expect.any(Array)
    );
  });

  it('does not show a duplicate alert when the previous as-needed dose was more than 30 minutes ago', async () => {
    mockMedications = [{ ...baseMed, frequency_when: 'as_needed' }];
    mockGetTodayLogs.mockResolvedValueOnce([makeLog(1, 45)]); // logged 45 min ago
    mockLogDose.mockResolvedValueOnce(makeLog(1, 0));

    const alertSpy = jest.spyOn(Alert, 'alert');

    render(<HomeScreen />);
    await waitFor(() => screen.getByLabelText('Log dose'));
    fireEvent.press(screen.getByLabelText('Log dose'));

    expect(alertSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(mockLogDose).toHaveBeenCalled());
  });
});
