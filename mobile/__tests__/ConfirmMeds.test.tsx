import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ConfirmMedsScreen from '../src/screens/onboarding/ConfirmMedsScreen';

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

const mockSetMedications = jest.fn();
const mockToggle = jest.fn();
let mockMedications: any[] = [];

jest.mock('../src/context/OnboardingContext', () => ({
  useOnboarding: () => ({
    patientId: 1,
    medications: mockMedications,
    setMedications: mockSetMedications,
    toggleMedicationStatus: mockToggle,
  }),
}));

const mockGetMedications = jest.fn();
const mockConfirmMedications = jest.fn();

jest.mock('../src/api/medications', () => ({
  getMedications: (...args: any[]) => mockGetMedications(...args),
  confirmMedications: (...args: any[]) => mockConfirmMedications(...args),
}));

// MedicationCard mock: renders med name and expose toggle buttons when onToggle is provided
jest.mock('../src/components/MedicationCard', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return ({ medication, onToggle }: any) => (
    <View testID={`med-card-${medication.id}`}>
      <Text>{medication.name}</Text>
      {onToggle ? (
        <>
          <TouchableOpacity
            testID={`still-taking-${medication.id}`}
            onPress={() => onToggle('active')}
          >
            <Text>Still taking</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID={`stopped-${medication.id}`}
            onPress={() => onToggle('inactive')}
          >
            <Text>Stopped</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text testID={`locked-${medication.id}`}>Always active</Text>
      )}
    </View>
  );
});

// Setup
beforeEach(() => {
  jest.clearAllMocks();
  mockMedications = [];
  mockGetMedications.mockResolvedValue([]);
  mockConfirmMedications.mockResolvedValue(undefined);
});

// Tests (US 11)
describe('ConfirmMedsScreen — US 11: Confirm Medications', () => {
  it('fetches medications for the patient on mount', async () => {
    render(<ConfirmMedsScreen />);

    await waitFor(() => {
      expect(mockGetMedications).toHaveBeenCalledWith(1);
    });
  });

  it('passes fetched medications to context via setMedications', async () => {
    const meds = [
      { id: 1, name: 'Metformin', source: 'provider', status: 'active', patient_id: 1,
        dosage: '500', dosage_metric: 'mg', frequency_when: 'once', frequency_period: 'daily' },
    ];
    mockGetMedications.mockResolvedValueOnce(meds);

    render(<ConfirmMedsScreen />);

    await waitFor(() => {
      expect(mockSetMedications).toHaveBeenCalledWith(meds);
    });
  });

  it('shows empty state when the patient has no medications', async () => {
    mockGetMedications.mockResolvedValueOnce([]);

    render(<ConfirmMedsScreen />);

    await waitFor(() => {
      expect(screen.getByText(/hasn't added your medications yet/i)).toBeTruthy();
    });
  });

  it('shows an error message when the fetch fails', async () => {
    mockGetMedications.mockRejectedValueOnce(new Error('Network error'));

    render(<ConfirmMedsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });
  });

  it('renders provider medications with toggle controls', async () => {
    mockMedications = [
      { id: 1, name: 'Metformin', source: 'provider', status: 'active', patient_id: 1,
        dosage: '500', dosage_metric: 'mg', frequency_when: 'once', frequency_period: 'daily' },
    ];

    render(<ConfirmMedsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('med-card-1')).toBeTruthy();
      expect(screen.getByTestId('still-taking-1')).toBeTruthy();
      expect(screen.getByTestId('stopped-1')).toBeTruthy();
    });
  });

  it('renders patient medications without toggle controls', async () => {
    mockMedications = [
      { id: 2, name: 'Vitamin D', source: 'patient', status: 'active', patient_id: 1,
        dosage: '1000', dosage_metric: 'IU', frequency_when: 'once', frequency_period: 'daily' },
    ];

    render(<ConfirmMedsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('locked-2')).toBeTruthy();
    });
  });

  it('calls toggleMedicationStatus when Stopped is pressed for a provider med', async () => {
    mockMedications = [
      { id: 1, name: 'Metformin', source: 'provider', status: 'active', patient_id: 1,
        dosage: '500', dosage_metric: 'mg', frequency_when: 'once', frequency_period: 'daily' },
    ];

    render(<ConfirmMedsScreen />);
    await waitFor(() => screen.getByTestId('stopped-1'));
    fireEvent.press(screen.getByTestId('stopped-1'));

    expect(mockToggle).toHaveBeenCalledWith(1, 'inactive');
  });

  it('calls toggleMedicationStatus when Still Taking is pressed for a provider med', async () => {
    mockMedications = [
      { id: 1, name: 'Metformin', source: 'provider', status: 'inactive', patient_id: 1,
        dosage: '500', dosage_metric: 'mg', frequency_when: 'once', frequency_period: 'daily' },
    ];

    render(<ConfirmMedsScreen />);
    await waitFor(() => screen.getByTestId('still-taking-1'));
    fireEvent.press(screen.getByTestId('still-taking-1'));

    expect(mockToggle).toHaveBeenCalledWith(1, 'active');
  });

  it('navigates to AddMissingMedication when the add button is pressed', async () => {
    render(<ConfirmMedsScreen />);

    await waitFor(() => screen.getByText('+ Add missing medication'));
    fireEvent.press(screen.getByText('+ Add missing medication'));

    expect(mockNavigate).toHaveBeenCalledWith('AddMissingMedication');
  });

  it('sends only provider medication statuses on Continue, then navigates to Reminders', async () => {
    mockMedications = [
      { id: 1, name: 'Metformin', source: 'provider', status: 'active', patient_id: 1,
        dosage: '500', dosage_metric: 'mg', frequency_when: 'once', frequency_period: 'daily' },
      { id: 2, name: 'Vitamin D', source: 'patient', status: 'active', patient_id: 1,
        dosage: '1000', dosage_metric: 'IU', frequency_when: 'once', frequency_period: 'daily' },
    ];

    render(<ConfirmMedsScreen />);
    await waitFor(() => screen.getByText('Continue'));
    fireEvent.press(screen.getByText('Continue'));

    await waitFor(() => {
      // Only the provider med (id: 1) should be sent; patient med (id: 2) is excluded
      expect(mockConfirmMedications).toHaveBeenCalledWith(1, [{ id: 1, status: 'active' }]);
      expect(mockNavigate).toHaveBeenCalledWith('Reminders');
    });
  });

  it('skips the API call when there are no provider medications', async () => {
    mockMedications = [
      { id: 2, name: 'Vitamin D', source: 'patient', status: 'active', patient_id: 1,
        dosage: '1000', dosage_metric: 'IU', frequency_when: 'once', frequency_period: 'daily' },
    ];

    render(<ConfirmMedsScreen />);
    await waitFor(() => screen.getByText('Continue'));
    fireEvent.press(screen.getByText('Continue'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Reminders'));
    expect(mockConfirmMedications).not.toHaveBeenCalled();
  });
});
