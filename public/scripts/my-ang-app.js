

var app = angular.module('myAngApp', ['ngTouch', 'ui.grid', 'myAngServices']);

app.controller('MainCtrl', ['$scope', 'TradeService', function ($scope, tradesService) {
    $scope.gridViewModel = {
        enableFiltering: true,

        columndefs: [
            { name: 'Date', field: 'date' },
            { name: 'Stock', field: 'stock' },
            { name: 'Qty', field: 'qty' },
            { name: 'Price', field: 'price' },
            { name: 'Typo', field: 'type' }
        ],
        data: []
    };

    tradesService.getTrades(1).then(trades => {
        $scope.gridViewModel.data = trades;
    });
    console.log('Grid data = ' + JSON.stringify($scope.gridViewModel.data));
}]);

