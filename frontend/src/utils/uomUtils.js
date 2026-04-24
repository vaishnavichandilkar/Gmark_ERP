/**
 * Utility to standardize unit display for GST compliance.
 * Maps common legacy unit names to official GST UOM codes.
 */
export const getStandardGstUom = (uom) => {
    if (!uom) return 'NOS';
    
    // If it's an object, check gst_uom first
    if (typeof uom === 'object') {
        if (uom.gst_uom) return uom.gst_uom.toUpperCase();
        if (uom.unit_name) return getStandardGstUom(uom.unit_name);
        return 'NOS';
    }

    const uomStr = String(uom).trim().toUpperCase();
    
    // Exact mapping for common words
    const mapping = {
        'WEIGHT': 'KGS',
        'KILOGRAM': 'KGS',
        'KG': 'KGS',
        'KGS': 'KGS',
        'GRAM': 'GMS',
        'GRAMS': 'GMS',
        'GM': 'GMS',
        'GMS': 'GMS',
        'NUMBERS': 'NOS',
        'NUMBER': 'NOS',
        'UNIT': 'NOS',
        'UNITS': 'NOS',
        'NOS': 'NOS',
        'PIECES': 'PCS',
        'PIECE': 'PCS',
        'PC': 'PCS',
        'PCS': 'PCS',
        'BOX': 'BOX',
        'PACKET': 'PAC',
        'PKT': 'PAC',
        'PACKS': 'PAC',
        'LTR': 'LTR',
        'LITRE': 'LTR',
        'LITER': 'LTR',
        'MTR': 'MTR',
        'METER': 'MTR',
        'METRE': 'MTR'
    };

    return mapping[uomStr] || uomStr;
};
