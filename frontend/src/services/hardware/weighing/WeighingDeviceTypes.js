/**
 * Universal Weighing Machine Types & Status Definitions
 */

export const ConnectionStatus = {
    DISCONNECTED: 'DISCONNECTED',
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    RECONNECTING: 'RECONNECTING',
    ERROR: 'ERROR',
};

export const WeightStability = {
    STABLE: 'STABLE',
    UNSTABLE: 'UNSTABLE',
    OVERLOAD: 'OVERLOAD',
    UNDERLOAD: 'UNDERLOAD',
    ZERO: 'ZERO',
};

export const ProtocolType = {
    GENERIC_ASCII: 'GENERIC_ASCII',     // ST,GS,+005.090kg\r\n (Essae, CAS, Contech, Yaohua)
    METTLER_TOLEDO: 'METTLER_TOLEDO',   // S S      5.090 kg (Mettler Toledo SICS)
    SIMPLE_DECIMAL: 'SIMPLE_DECIMAL',   // =0005.090 or +005.090\r (Avery, Citizen, Raw)
    SIMULATOR: 'SIMULATOR',             // Software simulated hardware scale
};

export const DefaultSerialConfig = {
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none', // 'none' | 'even' | 'odd'
    flowControl: 'none',
};
