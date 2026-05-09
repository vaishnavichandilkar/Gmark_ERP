import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { COLORS, voucherStyles } from './VoucherStyles';
import SearchableDropdown from './SearchableDropdown';

interface LedgerRow {
  id: string;
  account: string;
  amount: string;
}

interface LedgerEntryTableProps {
  rows: LedgerRow[];
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onUpdateRow: (id: string, field: 'account' | 'amount', value: string) => void;
  accounts: { label: string; value: string }[];
}

const LedgerEntryTable: React.FC<LedgerEntryTableProps> = ({ 
  rows, 
  onAddRow, 
  onRemoveRow, 
  onUpdateRow,
  accounts
}) => {
  return (
    <View style={voucherStyles.tableContainer}>
      <View style={voucherStyles.tableHeader}>
        <Text style={[voucherStyles.tableHeaderCell, { flex: 2 }]}>Account</Text>
        <Text style={[voucherStyles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Amount</Text>
        <View style={{ width: 40 }} />
      </View>

      {rows.map((row) => (
        <View key={row.id} style={voucherStyles.tableRow}>
          <View style={{ flex: 2, paddingHorizontal: 4 }}>
            <SearchableDropdown
              placeholder="Select Account"
              options={accounts}
              value={row.account}
              onSelect={(val) => onUpdateRow(row.id, 'account', val)}
            />
          </View>
          <View style={{ flex: 1, paddingHorizontal: 4 }}>
            <TextInput
              style={[voucherStyles.input, { textAlign: 'right', fontWeight: '800' }]}
              placeholder="0.00"
              keyboardType="numeric"
              value={row.amount}
              onChangeText={(val) => onUpdateRow(row.id, 'amount', val)}
            />
          </View>
          <TouchableOpacity 
            style={{ width: 40, alignItems: 'center' }}
            onPress={() => onRemoveRow(row.id)}
          >
            <Trash2 size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity 
        style={voucherStyles.addButton}
        onPress={onAddRow}
      >
        <Plus size={20} color={COLORS.primary} />
        <Text style={voucherStyles.addButtonText}>Add Row</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LedgerEntryTable;
