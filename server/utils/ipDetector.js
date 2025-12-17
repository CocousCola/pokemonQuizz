import os from 'os';

export function getLocalIP() {
    const interfaces = os.networkInterfaces();
    const candidates = [];

    for (const name of Object.keys(interfaces)) {
        // Ignorer les interfaces virtuelles connues pour poser problème
        const lowerName = name.toLowerCase();
        if (lowerName.includes('wsl') || 
            lowerName.includes('vethernet') || 
            lowerName.includes('docker') || 
            lowerName.includes('virtualbox') || 
            lowerName.includes('host-only')) {
            continue;
        }

        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                candidates.push({ name, address: iface.address });
            }
        }
    }

    // Priorité absolue au Wi-Fi (souvent en 192.168.x.x)
    const wifiIP = candidates.find(c => c.address.startsWith('192.168.'));
    if (wifiIP) return wifiIP.address;

    return candidates.length > 0 ? candidates[0].address : 'localhost';
}
