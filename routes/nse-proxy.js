var express = require('express');
var router = express.Router();

var NSE_QUOTE_URL = 'https://nseindia.com/live_market/dynaContent/live_watch/get_quote/ajaxGetQuoteJSON.jsp',
    proxy = require('express-request-proxy');

router.get('/*', function (req, res, next) {
    proxy({
        url: NSE_QUOTE_URL + '*',
        timeout: 5000,
        originalQuery: true
    })(req, res, next);
});

module.exports = router;
