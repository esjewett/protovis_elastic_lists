// Add duplicate removal to the array prototype - stolen from some blog

if (!Array.prototype.remove_dups) Array.prototype.remove_dups = function() {
  var result = [];

  label:for(var i=0; i<this.length;i++ ) {  
    for(var j=0; j<this.length; j++) {
      if(result[j]==this[i]) 
      continue label;
    }

    result[result.length] = this[i];
  }

  return result;
}                          

var Lists = function(facets, data, h, w, f, spacing, canvas, callback) {
  pv.Layout.call(this); 
        
  var cached_data = data,  
      data_stale = true,  
      bins = [], 
      orig_bins = [],           
      totals = [],
      col_vals = [],
      bin_vals = [],
      col_selections = [],
      bin_selections = [],
      y = [],                                       // y-scales
      char_test = new RegExp("([A-Z]|[a-z])+");     // test for text vs. numeric columns       

  var floory = function(y) {
    if(y > f) {
      return y;
    } else {
      return f;
    }
  }

  var total_height = function(a, b) {
    if(b.y == 0) {
      return a;
    } else {           
      return a + floory(b.y) + spacing;
    }
  }

  var filtered_data = this.data = function() {
    if(data_stale) {               
      var relevant_columns = [];

      relevant_columns = bin_selections.map(function(e,i) {

        // reduce on bin_vals and bin_selections to figure out if a column has a selection

        return bin_vals[i].reduce(function(a,b) {
          return a || e[b];
        },false);
      });                        

      cached_data = data.filter(function(e,i) {
        return relevant_columns.reduce(function(a,b,j) {
          if(b === true) {                                                                   
            return a && col_selections[j][(e[facets[j]["name"]])];
          } else {
            return a && true;
          }
        },true);         
      });                                        

      data_stale = false;

      return cached_data;
    } else {
      return cached_data;
    }     
  }  

  // build arrays of all values for each column, sorted      
  facets.forEach(function(e,i){
     
    var temp_col = [];
    col_vals[i] = [];     

    // build selection map
    col_selections[i] = {};
    bin_selections[i] = {};

    data.forEach(function(f){
      temp_col.push(f[e["name"]]);
    });

    // Remove duplicates from column values.
    col_vals[i] = temp_col.remove_dups();  
    
    // If not already defined in the facets["type"] key, figure out to the best of our
    // ability if the column is text or numeric. User can over-ride by defining this
    // key in the facets data structure.
    
    if(!e["type"]) {
      if(char_test.test(col_vals[i].join())) {
        e["type"] = "T";
      } else {
        e["type"] = "N";
      }
    }                                                                      

    // use default sort or number sort, depending on if column contains a-z or A-Z characters
    if(e["type"] == "T") {
      col_vals[i].sort();
    } else {
      col_vals[i].sort(function(a,b){
        return a-b;
      });
    }                                          
  });  

  // build arrays of values to use as bins, based on column value arrays
  col_vals.forEach(function(e,i){ 
    if(facets[i]["type"] == "T") {
      bin_vals[i] = e;         
    } else {
      bin_vals[i] = pv.range(Math.round((col_vals[i].shift() - facets[i]["step"]) / facets[i]["step"]) * facets[i]["step"],
        Math.round((col_vals[i].pop() + facets[i]["step"]) / facets[i]["step"]) * facets[i]["step"],
        facets[i]["step"]); 
    }
  });   

  // Build histogram bins                        
  // Note: All the function junk in there is to memoize/cache based
  // on facets[i]["stale"] being true/false  

  facets.forEach(function(e,i){ 
 
    e["stale"] = true;  

      // We redo the protovis histogram bin implementation to handle text-based values
      // with the same API as bins (minus .dx). 
                            
    bins.push((function () {   
      var bs = [];

      var bin_func = function(){
        if(e["stale"]) {
  
          bs = [];     
          
          if(e["type"] == "T") {     

            // Initialize bins                       
            col_vals[i].forEach(function(a,j) {
              var bin = bs[j] = [];
              bin.x = a;
              bin.dx = 1; 
  
              filtered_data().filter(function(b) {
                return b[facets[i]["name"]] == a;
              }).forEach(function(b) {
                bin.push(b);
              });        
                
              bin.y = bin.length;
            });   
          
          } else {  
            bs = pv.histogram(filtered_data(), function(d) { 
              return d[e["name"]] })
              .bins(bin_vals[i]) 
          }  
          
          bs.sort(function(a,b) {
            return b.y - a.y;
          });  
  
          e["stale"] = false; 
        }  

        return bs;
      }; 

      return bin_func;
    }()));                         
  });

  // build static cache of bin values for full data set
  facets.forEach(function(e,i) {
    orig_bins[i] = {};

    bins[i]().forEach(function(f) {
      function Bin(y,bins) {
        this.y = y;
        this.bins = bins;
      }      

      orig_bins[i][f.x] = new Bin(f.y, f)
    });                 
  }); 

  // calculate totals for each list visualization
  bins.forEach(function(e,i){
    totals.push(function() {
      return e().reduce(total_height,0) - spacing;
    }); 
  });

  // set up y-scales for each list visualization              
  totals.forEach(function(e){      
    y.push(function() {
      return pv.Scale.linear(0,e()).range(0,h);
    })   
  });          
                
  this.render = function() {
    
    var outside_panel = new pv.Panel()
      .width((w + 10) * y.length + 10).height(h + 30).fillStyle("lightgrey")
      .canvas(canvas);                    

    var list = outside_panel.add(pv.Panel)
      .data(bins) 
      .top(20)
      .left(function() {
        return 10 + ((w + 10) * this.index );
      })
      .width(w).height(h).fillStyle("lightgrey");

    // Column name labels

    list.anchor("top").add(pv.Label)
      .top(-15)     
      .font("bold 11px sans-serif")
      .text(function() {
        var full_label = facets[this.parent.index]["name"].toLowerCase();
        return full_label.substring(0,1).toUpperCase().concat(full_label.substring(1));
      });          

    var panel = list.add(pv.Panel)  
      .data(function(d){       
        return d();
      })                         
      .top(function() {              
        var sliced = bins[this.parent.index]().slice(0,this.index);
        var r = sliced.reduce(total_height, 0);
        return y[this.parent.index]()(r);
      })     
      .height(function(d) { 
        return y[this.parent.index]()(floory(d.y)) })
      .visible(function(d) { return !(d.y == 0);})

    var section = panel.add(pv.Bar)           
      .def("active", false)     
      .fillStyle(function(d) {
        return this.active() ? "orange" : bin_selections[this.parent.parent.index][d.x] ? "grey" : "steelblue"
      })
      .event("mouseover", function() { this.active(true); this.render() })
      .event("mouseout", function() { this.active(false); this.render() })
      .event("click", function(d) {                          

        // Make sure we properly set a selection for each element in the bin.
        orig_bins[this.parent.parent.index][d.x].bins.forEach(function(b,i) { 
          col_selections[this.parent.parent.index][b[facets[this.parent.parent.index]["name"]]] = 
            !bin_selections[this.parent.parent.index][d.x];  
        }, this);               

        // Make sure we have a selection that exactly matches the bin.          
        bin_selections[this.parent.parent.index][d.x] = !bin_selections[this.parent.parent.index][d.x];   

        this.active(false);
        data_stale = true;  

        facets.forEach(function(c) {
          c["stale"] = true;
        })                                                            

        list.render();   

        if(callback) {
          callback();
        };         
      });                                     

    section.anchor("left").add(pv.Label)
      .text(function(d) {

        var value = d.x;

        if(facets[this.parent.parent.index]["type"] == "N") {
          value++;
        } 

        var range = "";

        if(facets[this.parent.parent.index]["step"] > 1) {
          range = " to " + (d.x + facets[this.parent.parent.index]["step"]);
        }

        var t = value.toString() + range;
        if( d.y > 0 ) { 
          return t; 
        }
      }); 

    section.anchor("right").add(pv.Label)
      .text(function(d) {                                
        return d.y + "/" + orig_bins[this.parent.parent.index][d.x].y;
      });
    
    outside_panel.render();   
  }                            
};   

Lists.prototype = pv.extend(pv.Layout)
    .property("facets", Array)
    .property("height", Number)
    .property("weight", Number)
    .property("floor", Number)
    .property("spacing", Number)
    .property("canvas", String)
    .property("callback", Function);            