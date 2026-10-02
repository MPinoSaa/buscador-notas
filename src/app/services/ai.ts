import { Injectable } from '@angular/core';
import { auth } from '../firebase';
import { config } from '../config';

export class AiError extends Error {}

// Un poco más que el peor caso del backend (varios modelos con 45 s cada uno)
const REQUEST_TIMEOUT_MS = 150_000;

// Par "original -> resultado aprobado" con el que la IA aprende el estilo del equipo
export interface AiExample {
  title: string;
  tag: string;
  original: string;
  final: string;
}

export interface NoteDraft {
  title: string;
  tag: string;
  content: string;
}

// Cliente del backend: la clave de la IA vive solo allá, aquí se envía el token de sesión
@Injectable({ providedIn: 'root' })
export class AiService {
  // `redacted` = cuántos datos sensibles (contraseñas, IPs...) se ocultaron antes de enviarlos a la IA
  async restructure(note: NoteDraft): Promise<{ content: string; redacted: number }> {
    const data = await this.post('/api/notas/reestructurar', note, 'No se pudo reestructurar la nota.');
    return { content: data.content as string, redacted: Number(data.redacted) || 0 };
  }

  // Guarda un ejemplo aprobado. Es opcional: si falla, no debe estorbar al usuario
  async saveExample(example: AiExample): Promise<void> {
    try {
      await this.post('/api/notas/ejemplos', example, 'No se pudo guardar el ejemplo.');
    } catch (error) {
      console.warn('No se guardó el ejemplo para la IA:', error);
    }
  }

  private async post(path: string, payload: unknown, fallbackError: string) {
    if (!config.apiUrl) {
      throw new AiError('El asistente de IA aún no está disponible en la versión publicada.');
    }
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new AiError('Tu sesión expiró. Vuelve a iniciar sesión.');

    let response: Response;
    try {
      response = await fetch(`${config.apiUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
        // Sin tope, una conexión colgada deja al usuario esperando indefinidamente
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new AiError('La IA tardó demasiado en responder. Intenta de nuevo; si la nota es muy larga, prueba con una más corta.');
      }
      throw new AiError('No se pudo conectar con el servidor de IA. ¿Está encendido el backend?');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new AiError(data.error ?? fallbackError);
    return data;
  }
}
