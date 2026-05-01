import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import TrendsScreen from '../src/screens/TrendsScreen';

// Module mocks
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useFocusEffect: (effect: () => void) => {
    const R = require('react');
    R.useEffect(effect, []);
  },
}));

jest.mock('../src/context/OnboardingContext', () => ({
  useOnboarding: () => ({ patientId: 1 }),
}));

const mockGetMedicationHistory = jest.fn();
jest.mock('../src/api/medications', () => ({
  getMedicationHistory: (...args: any[]) => mockGetMedicationHistory(...args),
}));

// Helpers
function makeHistoryLog(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    id: daysAgo,
    medication_id: 1,
    medication_name: 'Metformin',
    dosage: '500',
    dosage_metric: 'mg',
    log_date: d.toISOString().slice(0, 10),
    logged_at: d.toISOString(),
  };
}

// Setup
beforeEach(() => {
  jest.clearAllMocks();
  mockGetMedicationHistory.mockResolvedValue({ logs: [], startDate: null, adherencePercent: 0 });
});

// Tests (US 15)
describe('TrendsScreen — US 15: Medication History', () => {
  it('fetches medication history on mount with the 7-day default', async () => {
    render(<TrendsScreen />);

    await waitFor(() => {
      expect(mockGetMedicationHistory).toHaveBeenCalledWith(1, 7);
    });
  });

  it('shows empty state message when no history exists', async () => {
    render(<TrendsScreen />);

    await waitFor(() => {
      expect(screen.getByText(/No dose history yet/)).toBeTruthy();
    });
  });

  it('shows medication name and dosage for logged doses', async () => {
    mockGetMedicationHistory.mockResolvedValue({ logs: [makeHistoryLog(1)], startDate: null, adherencePercent: 100 });

    render(<TrendsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Metformin')).toBeTruthy();
      expect(screen.getByText(/500 mg/)).toBeTruthy();
    });
  });

  it('labels the current day group "Today"', async () => {
    mockGetMedicationHistory.mockResolvedValue({ logs: [makeHistoryLog(0)], startDate: null, adherencePercent: 100 });

    render(<TrendsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeTruthy();
    });
  });

  it('shows a "Missed" badge for past days that have no logged doses', async () => {
    // Log only for today — yesterday and earlier (6 of 7 days) become missed
    mockGetMedicationHistory.mockResolvedValue({ logs: [makeHistoryLog(0)], startDate: null, adherencePercent: 14 });

    render(<TrendsScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('Missed').length).toBeGreaterThan(0);
    });
  });

  it('re-fetches with 30 days when the "30 days" filter is pressed', async () => {
    render(<TrendsScreen />);
    await waitFor(() => screen.getByText('30 days'));

    fireEvent.press(screen.getByText('30 days'));

    await waitFor(() => {
      expect(mockGetMedicationHistory).toHaveBeenCalledWith(1, 30);
    });
  });

  it('shows an error message when the API call fails', async () => {
    mockGetMedicationHistory.mockRejectedValue(new Error('Network error'));

    render(<TrendsScreen />);

    await waitFor(() => {
      expect(screen.getByText(/Could not load history/)).toBeTruthy();
    });
  });
});
