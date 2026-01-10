/**
 * Constantes de Red y Normalización de IPs
 * 
 * Módulo centralizado para constantes relacionadas con direcciones IP
 * y normalización de formatos de red.
 * 
 * Usado en: audit-ctrl.ts, billing-ctrl.ts
 */

/**
 * Direcciones localhost en diferentes formatos
 * Usadas para normalizar IPs en logs de auditoría
 */
const LOCALHOST_IPV6_SHORT = "::1"; // Formato corto IPv6 loopback
const LOCALHOST_IPV6_MAPPED = "::ffff:127.0.0.1"; // IPv4 127.0.0.1 mapeado en IPv6
const LOCALHOST_IPV4 = "127.0.0.1"; // Formato IPv4 estándar loopback

/**
 * Prefijo para direcciones IPv4 mapeadas en formato IPv6
 * Ejemplo: ::ffff:192.168.1.1 → 192.168.1.1
 */
const IPV6_PREFIX = "::ffff:";

/**
 * Normaliza direcciones IP a formato IPv4 estándar
 * 
 * Funcionalidad:
 * - Convierte localhost IPv6 (::1, ::ffff:127.0.0.1) a IPv4 (127.0.0.1)
 * - Remueve prefijo ::ffff: de IPs IPv4 mapeadas en IPv6
 * 
 * @param ip - Dirección IP a normalizar (puede ser undefined)
 * @returns Dirección IP normalizada en formato IPv4
 * 
 * @example
 * normalizeIP("::1") // "127.0.0.1"
 * normalizeIP("::ffff:127.0.0.1") // "127.0.0.1"
 * normalizeIP("::ffff:192.168.1.1") // "192.168.1.1"
 * normalizeIP("192.168.1.1") // "192.168.1.1"
 */
export function normalizeIP(ip: string | undefined): string {
  if (!ip) return "unknown";

  // Normalizar direcciones localhost a formato IPv4
  if (ip === LOCALHOST_IPV6_SHORT || ip === LOCALHOST_IPV6_MAPPED) {
    return LOCALHOST_IPV4;
  }

  // Convertir IPs IPv4 mapeadas en IPv6 a formato IPv4 puro
  if (ip.startsWith(IPV6_PREFIX)) {
    return ip.substring(IPV6_PREFIX.length);
  }

  return ip;
}
