import { looksSensitive } from './sensitive';

describe('looksSensitive', () => {
  it.each([
    'contraseña: Pa$$w0rd',
    'password = abc123',
    'la clave es hunter2',
    'API_KEY: xyz',
    'mysql://root:secreto@10.0.0.2/db',
    '-----BEGIN OPENSSH PRIVATE KEY-----'
  ])('detecta credenciales: %s', text => {
    expect(looksSensitive(text)).toBe(true);
  });

  it.each([
    'Reiniciar nginx y revisar el estado',
    'servidor 192.168.1.10 (solo una IP)',
    'las claves de acceso están en Bitwarden',
    'password: <SECRET_1>'
  ])('no alerta con texto normal: %s', text => {
    expect(looksSensitive(text)).toBe(false);
  });
});
