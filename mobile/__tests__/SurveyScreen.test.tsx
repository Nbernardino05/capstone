import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SurveyScreen from '../src/screens/SurveyScreen';

// Module mocks
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

let mockMedications: any[] = [];
jest.mock('../src/context/OnboardingContext', () => ({
  useOnboarding: () => ({ patientId: 1, medications: mockMedications }),
}));

const mockGetTodayLogs = jest.fn();
jest.mock('../src/api/medications', () => ({
  getTodayLogs: (...args: any[]) => mockGetTodayLogs(...args),
}));

const mockGetTodaySurvey = jest.fn();
const mockSubmitSurvey = jest.fn();
jest.mock('../src/api/surveys', () => ({
  getTodaySurvey: (...args: any[]) => mockGetTodaySurvey(...args),
  submitSurvey: (...args: any[]) => mockSubmitSurvey(...args),
}));

// Helpers
const baseMed = {
  id: 10,
  patient_id: 1,
  name: 'Metformin',
  dosage: '500',
  dosage_metric: 'mg',
  frequency_when: 'once',
  frequency_period: 'daily',
  source: 'provider',
  status: 'active',
};

function makeLog(medId: number) {
  return { id: 1, medication_id: medId, logged_at: new Date().toISOString() };
}

// Setup
beforeEach(() => {
  jest.clearAllMocks();
  mockMedications = [];
  mockGetTodayLogs.mockResolvedValue([]);
  mockGetTodaySurvey.mockResolvedValue(null);
  mockSubmitSurvey.mockResolvedValue({ id: 1 });
});

// Tests (US 17)
describe('SurveyScreen — US 17: Daily Check-In', () => {
  it('shows empty state when no medications were logged today', async () => {
    mockMedications = [];

    render(<SurveyScreen />);

    await waitFor(() => {
      expect(screen.getByText('No active medications to rate.')).toBeTruthy();
    });
  });

  it('displays a rating card for each medication logged today', async () => {
    mockMedications = [baseMed];
    mockGetTodayLogs.mockResolvedValue([makeLog(10)]);

    render(<SurveyScreen />);

    await waitFor(() => {
      expect(screen.getByText('Metformin')).toBeTruthy();
      expect(screen.getByText('How effective was it today?')).toBeTruthy();
    });
  });

  it('shows "Update" subtitle when an existing survey is found for today', async () => {
    mockMedications = [baseMed];
    mockGetTodayLogs.mockResolvedValue([makeLog(10)]);
    mockGetTodaySurvey.mockResolvedValue({
      id: 5,
      responses: [{ medication_id: 10, efficacy_rating: 3, side_effects: null }],
    });

    render(<SurveyScreen />);

    await waitFor(() => {
      expect(screen.getByText('Update your responses below.')).toBeTruthy();
    });
  });

  it('pre-fills efficacy rating from an existing survey response', async () => {
    mockMedications = [baseMed];
    mockGetTodayLogs.mockResolvedValue([makeLog(10)]);
    mockGetTodaySurvey.mockResolvedValue({
      id: 5,
      responses: [{ medication_id: 10, efficacy_rating: 4, side_effects: null }],
    });

    render(<SurveyScreen />);

    await waitFor(() => {
      // Rating 4 button should be in selected state
      expect(
        screen.getByRole('button', { name: 'Very effective' }).props.accessibilityState.selected
      ).toBe(true);
    });
  });

  it('shows an alert and does not submit when a medication is not rated', async () => {
    mockMedications = [baseMed];
    mockGetTodayLogs.mockResolvedValue([makeLog(10)]);

    const alertSpy = jest.spyOn(Alert, 'alert');
    render(<SurveyScreen />);
    await waitFor(() => screen.getByText('Metformin'));

    fireEvent.press(screen.getByText('Submit'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Rating required',
      expect.stringContaining('Metformin'),
    );
    expect(mockSubmitSurvey).not.toHaveBeenCalled();
  });

  it('calls submitSurvey with the patient id and correct rating payload', async () => {
    mockMedications = [baseMed];
    mockGetTodayLogs.mockResolvedValue([makeLog(10)]);

    render(<SurveyScreen />);
    await waitFor(() => screen.getByText('Metformin'));

    fireEvent.press(screen.getByLabelText('Very effective')); // rating 4
    fireEvent.press(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockSubmitSurvey).toHaveBeenCalledWith(
        1,
        expect.arrayContaining([
          expect.objectContaining({ medication_id: 10, efficacy_rating: 4 }),
        ]),
      );
    });
  });

  it('navigates back after a successful submission', async () => {
    mockMedications = [baseMed];
    mockGetTodayLogs.mockResolvedValue([makeLog(10)]);
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const ok = (buttons as any[])?.find((b: any) => b.text === 'OK');
      ok?.onPress?.();
    });

    render(<SurveyScreen />);
    await waitFor(() => screen.getByText('Metformin'));
    fireEvent.press(screen.getByLabelText('Very effective'));
    fireEvent.press(screen.getByText('Submit'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('selecting "None" for side effects clears all previously selected effects', async () => {
    mockMedications = [baseMed];
    mockGetTodayLogs.mockResolvedValue([makeLog(10)]);

    render(<SurveyScreen />);
    await waitFor(() => screen.getByText('Nausea'));

    // Select Nausea, then None — the submit payload should only contain "None"
    fireEvent.press(screen.getByText('Nausea'));
    fireEvent.press(screen.getByText('None'));

    fireEvent.press(screen.getByLabelText('Very effective'));
    fireEvent.press(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockSubmitSurvey).toHaveBeenCalled();
      const submitted = mockSubmitSurvey.mock.calls[0][1][0];
      expect(submitted.side_effects).toBe('None');
    });
  });
});
