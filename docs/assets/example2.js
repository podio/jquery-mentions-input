$(function () {

  $('textarea.mention-example2').mentionsInput({
    onDataRequest:function (mode, query, callback) {
      $.getJSON('assets/data.json', function(responseData) {
        responseData = _.filter(responseData, function(item) { return item.name.toLowerCase().indexOf(query.toLowerCase()) > -1 });
        callback.call(this, responseData);
      });
    }

  });

});