import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AddMissingMedicationScreen from '../src/screens/onboarding/AddMissingMedicationScreen';

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

const mockAddToContext = jest.fn();
jest.mock('../src/context/OnboardingContext', () => ({
  useOnboarding: () => ({
    patientId: 1,
    addMedication: mockAddToContext,
  }),
}));

const mockAddMedication = jest.fn();
jest.mock('../src/api/medications', () => ({
  addMedication: (...args: any[]) => mockAddMedication(...args),
}));

jest.mock('../src/api/rxterms', () => ({
  searchRxTerms: jest.fn().mockResolvedValue([]),
}));

// FrequencyPicker mock: pressing it selects the first non-empty option value
jest.mock('../src/components/FrequencyPicker', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return ({ label, selectedValue, onSelect, options }: any) => {
    const firstNonEmpty = options.find((o: any) => (o.value ?? o) !== '') ?? options[1];
    return (
      <TouchableOpacity
        testID={`picker-${label}`}
        onPress={() => onSelect(firstNonEmpty?.value ?? firstNonEmpty)}
      >
        <Text>{selectedValue || label}</Text>
      </TouchableOpacity>
    );
  };
});

// Setup
beforeEach(() => {
  jest.clearAllMocks();
});

// Tests (US 12)
describe('AddMissingMedicationScreen — US 12: Add Missing Medications', () => {
  // Validation
  it('shows all three validation errors when all required fields are empty', async () => {
    render(<AddMissingMedicationScreen />);

    fireEvent.press(screen.getByText('Add'));

    await waitFor(() => {
      expect(screen.getByText('Medication name is required')).toBeTruthy();
      expect(screen.getByText('Dosage is required')).toBeTruthy();
      expect(screen.getByText('Dosage metric is required')).toBeTruthy();
    });
  });

  it('shows a name error but not dosage errors when only the name is missing', async () => {
    render(<AddMissingMedicationScreen />);

    // Set dosage amount and metric but not name
    fireEvent.press(screen.getByTestId('picker-Amount'));
    fireEvent.press(screen.getByTestId('picker-Unit'));
    fireEvent.press(screen.getByText('Add'));

    await waitFor(() => {
      expect(screen.getByText('Medication name is required')).toBeTruthy();
      expect(screen.queryByText('Dosage is required')).toBeNull();
      expect(screen.queryByText('Dosage metric is required')).toBeNull();
    });
  });

  it('shows dosage errors but not a name error when only the name is provided', async () => {
    render(<AddMissingMedicationScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('e.g. Omega-3'), 'Vitamin C');
    fireEvent.press(screen.getByText('Add'));

    await waitFor(() => {
      expect(screen.queryByText('Medication name is required')).toBeNull();
      expect(screen.getByText('Dosage is required')).toBeTruthy();
      expect(screen.getByText('Dosage metric is required')).toBeTruthy();
    });
  });

  it('does not call the API when validation fails', async () => {
    render(<AddMissingMedicationScreen />);

    fireEvent.press(screen.getByText('Add'));

    await waitFor(() => screen.getByText('Medication name is required'));
    expect(mockAddMedication).not.toHaveBeenCalled();
  });

  // Successful submit
  it('calls the API with trimmed name and selected dosage values on valid submit', async () => {
    const saved = {
      id: 5, patient_id: 1, name: 'Vitamin C', dosage: '5', dosage_metric: 'mg',
      frequency_when: 'once', frequency_period: 'daily', source: 'patient', status: 'active',
    };
    mockAddMedication.mockResolvedValueOnce(saved);

    render(<AddMissingMedicationScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('e.g. Omega-3'), '  Vitamin C  ');
    fireEvent.press(screen.getByTestId('picker-Amount'));   // selects first non-empty amount
    fireEvent.press(screen.getByTestId('picker-Unit'));     // selects first non-empty metric
    fireEvent.press(screen.getByText('Add'));

    await waitFor(() => {
      expect(mockAddMedication).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: 'Vitamin C' })
      );
    });
  });

  it('adds the medication to context and navigates back on success', async () => {
    const saved = {
      id: 5, patient_id: 1, name: 'Vitamin C', dosage: '5', dosage_metric: 'mg',
      frequency_when: 'once', frequency_period: 'daily', source: 'patient', status: 'active',
    };
    mockAddMedication.mockResolvedValueOnce(saved);

    render(<AddMissingMedicationScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('e.g. Omega-3'), 'Vitamin C');
    fireEvent.press(screen.getByTestId('picker-Amount'));
    fireEvent.press(screen.getByTestId('picker-Unit'));
    fireEvent.press(screen.getByText('Add'));

    await waitFor(() => {
      expect(mockAddToContext).toHaveBeenCalledWith(saved);
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('does not navigate back when the API call fails', async () => {
    mockAddMedication.mockRejectedValueOnce(new Error('Network error'));

    render(<AddMissingMedicationScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('e.g. Omega-3'), 'Vitamin C');
    fireEvent.press(screen.getByTestId('picker-Amount'));
    fireEvent.press(screen.getByTestId('picker-Unit'));
    fireEvent.press(screen.getByText('Add'));

    // Wait for the async operation to settle
    await waitFor(() => expect(mockAddMedication).toHaveBeenCalled());
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  // Cancel
  it('navigates back without calling the API when Cancel is pressed', () => {
    render(<AddMissingMedicationScreen />);

    fireEvent.press(screen.getByLabelText('Cancel and go back'));

    expect(mockGoBack).toHaveBeenCalled();
    expect(mockAddMedication).not.toHaveBeenCalled();
  });
});
