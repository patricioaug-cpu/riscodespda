export async function getDeviceId(): Promise<string> {
  // Check if we already have a device ID in localStorage
  const storedId = localStorage.getItem('riscopro_device_id');
  if (storedId) return storedId;

  // Generate a fingerprint based on browser characteristics
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    (navigator as any).deviceMemory || 'unknown',
    (navigator as any).hardwareConcurrency || 'unknown',
  ];

  const fingerprint = components.join('|');
  
  // Hash the fingerprint string to get a fixed-length ID
  const msgUint8 = new TextEncoder().encode(fingerprint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const finalId = `dev_${hashHex.substring(0, 16)}`;
  
  // Store it for future use
  localStorage.setItem('riscopro_device_id', finalId);
  
  return finalId;
}
