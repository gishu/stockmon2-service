module.exports = function(qty, price){
    var hdfc_brokerage = 0.0067 ;
    return price.times(qty).times(hdfc_brokerage).round(2);
};