$(function() {
  
  $("button").click(function(e){
    
    e.preventDefault();
    
    var url = $("input").val();
    
    if (url.length == 0) {
      $("#output").html('Enter a URL above and hit submit!');
    }
    
    else if (0 < url.length > 5000) {
      $("#output").html('Sorry, but that URL is too long. The limit is 5000 characters.');
    }
    else {
      $.ajax({
        method: "POST",
        url: "/shorten",
        data: {"longURL": url},
        success: function(res) {
          $("#output").html(
            "<h3>Your shortened URL is:</h3><div><h2>https://statuesque-serpent.glitch.me/" + res + "</h2></div>"
          );
        }
      })
    }
  });
  
})