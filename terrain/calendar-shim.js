(() => {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      const originalUrl = input instanceof Request ? input.url : String(input);
      const url = new URL(originalUrl, window.location.href);
      if (url.hostname === 'acj-ogust-proxy.vercel.app' && url.pathname === '/api/terrain-calendar') {
        url.pathname = '/api/ogust-customer';
        url.searchParams.set('action', 'calendar');
        if (input instanceof Request) {
          return nativeFetch(new Request(url.toString(), input), init);
        }
        return nativeFetch(url.toString(), init);
      }
    } catch (_) {}
    return nativeFetch(input, init);
  };
})();
