import { normalizeIP } from "../utils/networkConstants";

describe("normalizeIP", () => {
  describe("Localhost IPv6 normalization", () => {
    test("should convert IPv6 short format ::1 to 127.0.0.1", () => {
      expect(normalizeIP("::1")).toBe("127.0.0.1");
    });

    test("should convert IPv6 mapped format ::ffff:127.0.0.1 to 127.0.0.1", () => {
      expect(normalizeIP("::ffff:127.0.0.1")).toBe("127.0.0.1");
    });
  });

  describe("IPv6 to IPv4 conversion", () => {
    test("should remove ::ffff: prefix from mapped IPv4 addresses", () => {
      expect(normalizeIP("::ffff:192.168.1.1")).toBe("192.168.1.1");
    });

    test("should remove ::ffff: prefix from public IPs", () => {
      expect(normalizeIP("::ffff:8.8.8.8")).toBe("8.8.8.8");
    });
  });

  describe("IPv4 passthrough", () => {
    test("should return IPv4 addresses unchanged", () => {
      expect(normalizeIP("192.168.1.1")).toBe("192.168.1.1");
    });

    test("should return localhost IPv4 unchanged", () => {
      expect(normalizeIP("127.0.0.1")).toBe("127.0.0.1");
    });

    test("should return public IPs unchanged", () => {
      expect(normalizeIP("8.8.8.8")).toBe("8.8.8.8");
    });
  });

  describe("Edge cases", () => {
    test("should return 'unknown' for undefined input", () => {
      expect(normalizeIP(undefined)).toBe("unknown");
    });

    test("should return 'unknown' for empty string", () => {
      expect(normalizeIP("")).toBe("unknown");
    });

    test("should handle native IPv6 addresses without ::ffff: prefix", () => {
      expect(normalizeIP("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    });
  });
});
