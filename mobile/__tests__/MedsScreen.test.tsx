import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import MedsScreen from '../src/screens/MedsScreen';

// Module mocks
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockDeactivateMedication = jest.fn();
let mockMedications: any[] = [];
jest.mock('../src/context/OnboardingContext', () => ({
  useOnboarding: () => ({
    patientId: 1,
    medications: mockMedications,
    deactivateMedication: mockDeactivateMedication,
  }),
}));

const mockApiDeactivate = jest.fn();
jest.mock('../src/api/medications', () => ({
  deactivateMedication: (...args: any[]) => mockApiDeactivate(...args),
}));

jest.mock('../src/constants/frequencies', () => ({
  formatFrequency: () => 'once daily',
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

// Setup
beforeEach(() => {
  jest.clearAllMocks();
  mockMedications = [];
  mockApiDeactivate.mockResolvedValue({});
});

// Tests
describe('MedsScreen — Medications List', () => {
  it('shows empty state when there are no active medications', () => {
    render(<MedsScreen />);
    expect(screen.getByText('No active medications')).toBeTruthy();
  });

  it('renders active medication name and dosage', () => {
    mockMedications = [baseMed];
    render(<MedsScreen />);
    expect(screen.getByText('Metformin')).toBeTruthy();
    expect(screen.getByText(/500 mg/)).toBeTruthy();
  });

  it('shows "Provider-added" tag for provider-sourced medications', () => {
    mockMedications = [{ ...baseMed, source: 'provider' }];
    render(<MedsScreen />);
    expect(screen.getByText('Provider-added')).toBeTruthy();
  });

  it('does not show "Provider-added" tag for patient-added medications', () => {
    mockMedications = [{ ...baseMed, source: 'patient' }];
    render(<MedsScreen />);
    expect(screen.queryByText('Provider-added')).toBeNull();
  });

  it('renders inactive medications under the "Stopped" section', () => {
    mockMedications = [{ ...baseMed, status: 'inactive' }];
    render(<MedsScreen />);
    // Both the section label and the card tag render "Stopped"
    expect(screen.getAllByText('Stopped').length).toBeGreaterThan(0);
    expect(screen.getByText('Metformin')).toBeTruthy();
  });

  it('navigates to EditMedication screen with the medication when Edit is pressed', () => {
    mockMedications = [baseMed];
    render(<MedsScreen />);

    fireEvent.press(screen.getByLabelText('Edit Metformin'));

    expect(mockNavigate).toHaveBeenCalledWith('EditMedication', { medication: baseMed });
  });

  it('shows a confirmation alert when "Stop taking" is pressed', () => {
    mockMedications = [baseMed];
    const alertSpy = jest.spyOn(Alert, 'alert');

    render(<MedsScreen />);
    fireEvent.press(screen.getByLabelText('Stop taking Metformin'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Stop taking medication?',
      expect.stringContaining('Metformin'),
      expect.any(Array),
    );
  });

  it('calls the API and updates context when stop is confirmed', async () => {
    mockMedications = [baseMed];
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const stopBtn = (buttons as any[])?.find((b: any) => b.text === 'Stop taking');
      stopBtn?.onPress?.();
    });

    render(<MedsScreen />);
    fireEvent.press(screen.getByLabelText('Stop taking Metformin'));

    await waitFor(() => {
      expect(mockApiDeactivate).toHaveBeenCalledWith(1, 1);
      expect(mockDeactivateMedication).toHaveBeenCalledWith(1);
    });
  });

  it('does not call the API when the stop confirmation is cancelled', async () => {
    mockMedications = [baseMed];
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const cancelBtn = (buttons as any[])?.find((b: any) => b.text === 'Cancel');
      cancelBtn?.onPress?.();
    });

    render(<MedsScreen />);
    fireEvent.press(screen.getByLabelText('Stop taking Metformin'));

    await waitFor(() => {
      expect(mockApiDeactivate).not.toHaveBeenCalled();
    });
  });
});
