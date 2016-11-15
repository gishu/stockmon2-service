
(function () {

    var serviceModule = angular.module('myAngServices', []);

    serviceModule.service('TradeService', ['$http', '$q', tradeSvcFactory]);

    function tradeSvcFactory($http, $q) {
        return {
            getTrades: function (accountId) {
                var trades = $q.defer();

                $http({
                    method: 'GET',
                    url: '/accounts/' + accountId + '/trades',
                    headers: { 'Accept': 'application/json' }
                }).then(
                    function (resp) {
                        trades.resolve(resp.data);
                    },
                    function (error) {
                        trades.reject(error);
                    });
                return trades.promise;
            },

            getHoldingsForYear: function (accountId, year) {
                var deferred = $q.defer();

                $http({
                    method: 'GET',
                    url: '/accounts/' + accountId + '/snapshots/' + year + '/holdings',
                    headers: { 'Accept': 'application/json' }
                }).then(
                    function (resp) {
                        deferred.resolve(resp.data);
                    },
                    function (error) {
                        deferred.reject(error);
                    });
                return deferred.promise;
            }
        };
    }

})();
