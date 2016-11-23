

(function () {

    var serviceModule = angular.module('myAngServices');

    serviceModule.service('StockQuoteService', ['$http', '$q', quoteSvcFactory]);

    function sanitizeNumber(input) {
        return _.toNumber(input.replace(',', ''));
    }

    function quoteSvcFactory($http, $q) {
        var symbol_map = {
            "ADANI POWER": "ADANIPOWER",
            "ALOK": "ALOKTEXT",
            "AND BANK": "ANDHRABANK",
            "ASHOK": "ASHOKLEY",
            "BLUE STAR": "BLUESTARCO",
            "CAN BANK": "CANBK",
            "CENTURY": "CENTURYTEX",
            "COAL IND": "COALINDIA",
            "CROM GREAVES": "CROMPGREAV",
            "CROMPTON ELEC": "CROMPTON",
            "EICHER": "EICHERMOT",
            "EXIDE": "EXIDEIND",
            "GAIL": "GAIL",
            "HDFC": "",
            "HDFCBANK": "",
            "HIND ZINC": "HINDZINC",
            "HINDAL": "HINDALCO",
            "HPCL": "HINDPETRO",
            "HUL": "HINDUNILVR",
            "IDEA": "",
            "L&T": "LT",
            "L&T FIN": "L%26TFH",
            "LIC": "LICHSGFIN",
            "M&M": "M%26M",
            "MARUTI": "",
            "NTPC": "",
            "ONGC": "",
            "POWERG": "POWERGRID",
            "SAIL": "",
            "SBI": "SBIN",
            "TATA MOTORS": "TATAMOTORS",
            "TATA POW": "TATAPOWER",
            "TATA ST": "TATASTEEL",
            "TCS": "",
            "TECHM": "",
            "STEEL STRIPS": "SSWL",
            "VOLTAS":""
        },
            NSE_PROXY_URL = "/nseProxy?symbol=";

        return {
            getQuotesFor: function (symbols) {
                var map_nsesym_to_sym = _(symbols).map(s => _(symbol_map).has(s) ? [(symbol_map[s] || s), s] : null)
                    .compact()
                    .value();

                var map = _.fromPairs(map_nsesym_to_sym);

                var deferred = $q.defer();

                // NSE API returns blank results is queried for >5 stocks
                var getQuoteCalls = _.map(_.chunk(map_nsesym_to_sym, 5),
                    c => $http.get(NSE_PROXY_URL + _.map(c, pair => pair[0]).join(',')));

                $q.all(getQuoteCalls)
                    .then(function (responses) {
                        var results = _.map(responses, resp => {
                            return _.map(resp.data.data, function (quote) {
                                // stock symbol => info
                                return [map[quote.symbol.replace('&amp;','%26')],
                                    {
                                        s: quote.symbol,
                                        p: sanitizeNumber(quote.lastPrice),
                                        c: sanitizeNumber(quote.change),
                                        r52: quote.low52 + ' - ' + quote.high52
                                    }];
                            });
                        });
                        deferred.resolve(_(results).flatten().fromPairs().value());

                    },
                    (error) => deferred.reject(error));

                return deferred.promise;
            }
        };
    }

})();
