import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform,
  Alert
} from 'react-native';
import { X, Calendar, Save } from 'lucide-react-native';
import { voucherStyles, COLORS } from './VoucherStyles';
import LedgerEntryTable from './LedgerEntryTable';
import SearchableDropdown from './SearchableDropdown';

interface VoucherModalProps {
  isVisible: boolean;
  onClose: () => void;
  voucherType: 'Receipt' | 'Payment' | 'Journal' | 'Contra';
}

const VoucherModal: React.FC<VoucherModalProps> = ({ isVisible, onClose, voucherType }) => {
  const [date, setDate] = useState(new Date().toLocaleDateString('en-GB'));
  const [bankCash, setBankCash] = useState('');
  const [narration, setNarration] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [rows, setRows] = useState([{ id: '1', account: '', amount: '' }]);

  // Dummy Data
  const accounts = [
    { label: 'HDFC Current Account', value: '1' },
    { label: 'SBI Savings Account', value: '2' },
    { label: 'Petty Cash', value: '3' },
    { label: 'Main Cash Vault', value: '4' },
    { label: 'TechCorp Industries', value: '5' },
    { label: 'Global Logistics', value: '6' },
  ];

  const paymentModes = [
    { label: 'Cash', value: 'Cash' },
    { label: 'UPI', value: 'UPI' },
    { label: 'Debit Card', value: 'Debit Card' },
    { label: 'Credit Card', value: 'Credit Card' },
    { label: 'Net Banking', value: 'Net Banking' },
    { label: 'Cheque', value: 'Cheque' },
  ];

  const addRow = () => {
    setRows([...rows, { id: Math.random().toString(), account: '', amount: '' }]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter(row => row.id !== id));
    } else {
      Alert.alert('Error', 'At least one row is required');
    }
  };

  const updateRow = (id: string, field: 'account' | 'amount', value: string) => {
    setRows(rows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const isSaveDisabled = !bankCash || rows.some(r => !r.account || !r.amount);

  const handleSave = () => {
    Alert.alert('Success', `${voucherType} Voucher Saved Successfully!`);
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={voucherStyles.modalOverlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={voucherStyles.modalContent}
        >
          {/* Header */}
          <View style={voucherStyles.header}>
            <Text style={voucherStyles.title}>{voucherType} Voucher</Text>
            <TouchableOpacity onPress={onClose} style={voucherStyles.closeButton}>
              <X size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={voucherStyles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header Row */}
            <View style={voucherStyles.row}>
              <View style={voucherStyles.inputGroup}>
                <Text style={voucherStyles.label}>Date</Text>
                <TouchableOpacity style={[voucherStyles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <Text style={{ fontSize: 15, color: COLORS.text }}>{date}</Text>
                  <Calendar size={18} color={COLORS.label} />
                </TouchableOpacity>
              </View>
              <View style={voucherStyles.inputGroup}>
                <SearchableDropdown
                  label="Bank / Cash"
                  placeholder="Select Source"
                  options={accounts}
                  value={bankCash}
                  onSelect={setBankCash}
                />
              </View>
            </View>

            {/* Middle Section: Ledger Table */}
            <Text style={voucherStyles.sectionTitle}>Ledger Entries</Text>
            <LedgerEntryTable
              rows={rows}
              accounts={accounts}
              onAddRow={addRow}
              onRemoveRow={removeRow}
              onUpdateRow={updateRow}
            />

            {/* Bottom Section */}
            <View style={{ marginTop: 12 }}>
              <Text style={voucherStyles.label}>Narration</Text>
              <TextInput
                style={[voucherStyles.input, voucherStyles.textarea]}
                placeholder="Enter narration"
                multiline
                numberOfLines={4}
                value={narration}
                onChangeText={setNarration}
              />
            </View>

            <View style={{ marginTop: 20 }}>
              <SearchableDropdown
                label="Payment Mode"
                placeholder="Select Mode"
                options={paymentModes}
                value={paymentMode}
                onSelect={setPaymentMode}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={voucherStyles.footer}>
            <TouchableOpacity 
              style={[voucherStyles.button, voucherStyles.cancelButton]} 
              onPress={onClose}
            >
              <Text style={[voucherStyles.buttonText, voucherStyles.cancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                voucherStyles.button, 
                voucherStyles.saveButton,
                isSaveDisabled && voucherStyles.disabledButton
              ]} 
              onPress={handleSave}
              disabled={isSaveDisabled}
            >
              <Save size={18} color={COLORS.white} />
              <Text style={[voucherStyles.buttonText, voucherStyles.saveButtonText]}>Save Voucher</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default VoucherModal;
