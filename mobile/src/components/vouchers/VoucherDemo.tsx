import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { COLORS } from './VoucherStyles';
import VoucherModal from './VoucherModal';
import { ChevronDown, FilePlus } from 'lucide-react-native';

const VoucherDemo = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<'Receipt' | 'Payment' | 'Journal' | 'Contra'>('Receipt');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const voucherTypes: ('Receipt' | 'Payment' | 'Journal' | 'Contra')[] = [
    'Receipt', 'Payment', 'Journal', 'Contra'
  ];

  const handleOpenVoucher = (type: 'Receipt' | 'Payment' | 'Journal' | 'Contra') => {
    setSelectedType(type);
    setModalVisible(true);
    setDropdownOpen(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header / Navbar Dropdown Simulation */}
      <View style={styles.navbar}>
        <Text style={styles.brand}>Gmark ERP</Text>
        <TouchableOpacity 
          style={styles.dropdownTrigger}
          onPress={() => setDropdownOpen(!dropdownOpen)}
        >
          <FilePlus size={20} color={COLORS.white} />
          <Text style={styles.dropdownLabel}>Create Voucher</Text>
          <ChevronDown size={16} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {dropdownOpen && (
        <View style={styles.dropdownMenu}>
          {voucherTypes.map(type => (
            <TouchableOpacity 
              key={type}
              style={styles.menuItem}
              onPress={() => handleOpenVoucher(type)}
            >
              <Text style={styles.menuItemText}>{type} Voucher</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Hero Section */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Financial Management</Text>
        <Text style={styles.heroSubtitle}>Efficiently manage your accounts on the go</Text>
      </View>

      <VoucherModal 
        isVisible={modalVisible}
        onClose={() => setModalVisible(false)}
        voucherType={selectedType}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  navbar: {
    height: 64,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  brand: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  dropdownLabel: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 64,
    right: 20,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 20,
    paddingVertical: 8,
    width: 180,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: COLORS.label,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default VoucherDemo;
