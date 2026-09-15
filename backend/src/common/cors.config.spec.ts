import { handleCorsOrigin } from './cors.config';

describe('handleCorsOrigin', () => {
  it('should allow requests with no origin (e.g. server-to-server or curl)', (done) => {
    handleCorsOrigin(undefined, 'http://localhost:3000', (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
      done();
    });
  });

  it('should allow explicitly configured origins in CORS_ORIGIN', (done) => {
    const corsEnv = 'http://localhost:3000,https://app.example.com';
    handleCorsOrigin('https://app.example.com', corsEnv, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
      done();
    });
  });

  it('should allow origins with trailing slashes matching configured origin without trailing slashes', (done) => {
    const corsEnv = 'http://localhost:3000';
    handleCorsOrigin('http://localhost:3000/', corsEnv, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
      done();
    });
  });

  it('should reject unconfigured / untrusted origins', (done) => {
    const corsEnv = 'http://localhost:3000';
    handleCorsOrigin('https://evil-site.com', corsEnv, (err, allow) => {
      expect(err).toBeInstanceOf(Error);
      expect(err?.message).toBe('Not allowed by CORS');
      expect(allow).toBe(false);
      done();
    });
  });

  it('should reject malicious origins containing substrings like localhost (e.g. evil-localhost.com)', (done) => {
    const corsEnv = 'http://localhost:3000';
    handleCorsOrigin('http://evil-localhost.com', corsEnv, (err, allow) => {
      expect(err).toBeInstanceOf(Error);
      expect(err?.message).toBe('Not allowed by CORS');
      expect(allow).toBe(false);
      done();
    });
  });

  it('should NOT allow arbitrary origins if CORS_ORIGIN is set to wildcard *', (done) => {
    handleCorsOrigin('https://any-site.com', '*', (err, allow) => {
      expect(err).toBeInstanceOf(Error);
      expect(err?.message).toBe('Not allowed by CORS');
      expect(allow).toBe(false);
      done();
    });
  });

  it('should fallback to default local ports if CORS_ORIGIN is not set', (done) => {
    handleCorsOrigin('http://localhost:3000', undefined, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
      done();
    });
  });
});
