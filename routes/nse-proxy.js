var express = require('express');
var router = express.Router();

var httpProxy = require('http-proxy'),
  apiProxy = httpProxy.createProxyServer(),
  NSE_QUOTE_URL = "https://nseindia.com/live_market/dynaContent/live_watch/get_quote/ajaxGetQuoteJSON.jsp";

apiProxy.on('proxyReq', function (proxyReq, req, res, options) {
  console.log('Initiating Proxy request ... ');
  // Remove a pesky trailing slash because the NSE url is not a REST end point
  proxyReq.path = proxyReq.path.replace('jsp/?', 'jsp?');

});

apiProxy.on('error', function (err, req, res) {
  console.log(err);
  res.writeHead(500, {
    'Content-Type': 'text/plain'
  });

  res.end('Error in proxy request.');
});

router.get('/', function (req, res) {
  apiProxy.web(req, res, {
    target: NSE_QUOTE_URL,
    changeOrigin: true
  });
});

module.exports = router;
