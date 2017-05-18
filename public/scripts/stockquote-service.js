

(function () {
    var serviceModule = angular.module('myAngServices');

    serviceModule.service('StockQuoteService', ['$http', '$q', quoteSvcFactory]);

    function sanitizeNumber(input) {
        return _.toNumber(input.replace(',', ''));
    }

    function quoteSvcFactory($http, $q) {

        let NSE_PROXY_URL = "/nseProxy?symbol=";

        return {
            getQuotesFor: function (symbols) {
                let encodedSymbols = _.map(symbols, s => encodeURIComponent(s));
                var deferred = $q.defer();

                // NSE API returns blank results is queried for >5 stocks
                var getQuoteCalls = _.map(_.chunk(encodedSymbols, 5),
                    batchOf5 => $http.get(NSE_PROXY_URL + _.join(batchOf5, ',')));

                $q.all(getQuoteCalls)
                    .then(function (responses) {
                        var allQuotes = _(responses)
                            .map(resp => resp.data.data)
                            .reduce(function (result, object) {
                                return _.assign(result, object);
                            },
                            {});

                        deferred.resolve(allQuotes);

                    },
                    (error) => deferred.reject(error));

                return deferred.promise;

            }
        };
    }

})();
