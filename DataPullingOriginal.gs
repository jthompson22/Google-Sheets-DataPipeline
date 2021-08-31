/*
// CONTROLLER CELLS:
const CONTROLLER_VALUES= "A9:B10"; 
const RAW_DATA = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("RawData");
const TICKET_DICTIONARY = {
  "TICKET#": 'number',
  "NAME": 'customer_business_then_name',
  "DAYS": 'created_at', 
  "DIAGNOSE": '',
  "COMPLETED": 'resolved_at',
  "DATE ADDED": '',
  "STATUS": 'status',
  "LAST UPDATED": 'updated_at',
  "TECH": ['user', 'full_name']
  };
const ESTIMATE_DICTIONARY = {
  "ESTIMATE": "created_at",
  "APPROVED": "start_at"};
const RAWDATA_HEADER = {
  'TICKET#': 'A', 	
  'NAME': 'B',
  'DAYS': 'C',
  'DIAGNOSE': 'D',
  'ESTIMATE': 'E',	
  'APPROVED': 'F',
  'COMPLETED': 'G',	
  'DATE ADDED': 'H',	
  'STATUS': 'I',
  'LAST UPDATED': 'J',
  'TECH': 'K'
};


//SCRIPT EXECUTION FUNCTIONS:
function executeScript(){
  let [ticket_data, lookup_dictionary] = syncData();
  udpateData(ticket_data, lookup_dictionary);
}

function udpateData(ticket_data, lookup_dictionary){
  let lastRow = RAW_DATA.getLastRow() + 1; 

// (1) loop through the rows in the database, and update all values: IF the value exists thats in Column A "TICKET#", get the index value in      lookup dictionary and update the row with the new ticket data. ELSE the value does not exist in lookup dictionary in which case its a blank. At the end of this excution, only the new values not previously in the database will be left in lookup dictionary. 
  let row;
  for (row = 2; row < lastRow; row++){
    let cell_value = RAW_DATA.getRange('A'+ String(row)).getValue();


    if (cell_value in lookup_dictionary){
      let index = lookup_dictionary[cell_value];
      writeRow(row, ticket_data[index]);
      delete lookup_dictionary[cell_value];

    }
    else {
      console.log('Row  ticket# Not in Dictionary');
      console.log("Row: " + row, "Cell Value: " + cell_value);
    }
  }

    //(2) Add the remaining values in lookupdictionary to the database. 
  row = lastRow;  
  for (let key in  lookup_dictionary) {
    let value = lookup_dictionary[key]
    writeRow(row, ticket_data[value]);
    row+=1; 
  };
  
};

function syncData(){
  let final_data = []
  let lookup_dictionary = {}

  //(1) Make an API call to the Repair Shopper and return arrays of all estimates and all tickets
  let tickets = makeApiCall('tickets').tickets;
  let estimates = makeApiCall('estimates').estimates;


  //(2) Loop through the ticket array:
  tickets.forEach(function(value, index){

     //(2A) get Diagnose and get Date Added from comment subject line
    let diagnose, date_added;
    if (value['comments']){
      let comments_array = value['comments'];
      comments_array.forEach(comments_value => {
        let date;
        let subject = comments_value['subject'].toLowerCase();
        if(subject === 'initial issue'){
          date = new Date(comments_value['created_at']); 
          date_added = date; 
        }
        if(subject === 'diagnosis'){
          date = new Date(comments_value['created_at']); 
          diagnose = date; 
        }
      });
    };
        
    //(2B)IF their is a property called "dated_added" and resolve at does not exist: today - date added; ELSE IF both exist: resolved_at - date_added; ElSE: empty string; 
    let days; 
    let today = new Date();
    //(2B) IF the property value.resolved_does not exist, null, or empty, subract today from date_added; ELSE use resolved at to subtract.
    if(!value.resolved_at && date_added){
      days = today.getTime() - date_added.getTime();
      days = Math.floor((days) / (1000 * 3600 * 24)); 
    }
    else if (date_added){
      let temp = new Date(value.resolved_at);
      days = temp.getTime() - date_added.getTime(); 
      days = Math.floor((days) / (1000 * 3600 * 24)); 
    }
    else{
      days = 'Resolved At, Date_Added: DNE';
    }
    console.log(value['customer_business_then_name'], date_added, value.resolved_at);

    //(2C) add to lookup_dictionary as key: ticket and value: index
    lookup_dictionary[value['number']] = index; 

    //(2D) create a temporary dictionary with items corrpesonding to properties. 
    temp_dic = {
      "TICKET#": value['number'],
      "NAME": value['customer_business_then_name'],
      "DAYS":  days, 
      "DIAGNOSE": diagnose,
      "COMPLETED": new Date(value['resolved_at']),
      "DATE ADDED": date_added,
      "STATUS": value['status'],
      "LAST UPDATED": new Date(value['updated_at']),
      "TECH": value['user']['full_name']
    }
    
    //(2E) Loop through Estimates dictionary?
    let ticket_id = value['id'];
    var ticket = estimates.filter(function(element, index){
      if (element['ticket_id'] == ticket_id){
        return element;
      }
    });
    if (ticket){
      temp_dic["ESTIMATE"] = new Date(ticket["created_at"]);
        if(estimates_value['status'] === 'Approved'){
          temp_dic["APPROVED"] = new Date(ticket["updated_at"]);
        }
        else if (estimates_value['status'] === 'Rejected'){
          temp_dic["APPROVED"] = 'Rejected';
        }
        else {
          temp_dic["APPROVED"] = 'No Estimate Value';
        }
    }
    /*estimates.forEach(function(estimates_value, estimate_index){
      //(2E-1) If there is an estimate matching the ticket ID; update the temp dictionary with the correpsonding logic
      if (estimates_value['ticket_id'] == ticket_id){
        temp_dic["ESTIMATE"] = new Date(estimates_value["created_at"]);
        if(estimates_value['status'] === 'Approved'){
          temp_dic["APPROVED"] = new Date(estimates_value["updated_at"]);
        }
        else if (estimates_value['status'] === 'Rejected'){
          temp_dic["APPROVED"] = 'Rejected';
        }
        else {
          temp_dic["APPROVED"] = 'No Estimate Value';
        }
        //(2E-2)remove the index value so we do not have to loop over it again
      estimates.splice(estimate_index, 1);
      break;
      }
    });

    final_data.push(temp_dic);
  });
  
  //console.log(lookup_dictionary);
  return [final_data, lookup_dictionary]; 
}



//HELPER FUNCTIONS BELOW:
//This helper function allows you to quickly ping the API to test what data you get back. 
function apiPinger(){
  //(1) Ping estimates API
  //let dummy_number = 4204;
  //let estimate_response = makeApiCall('estimates', dummy_number).estimates;
  //console.log(estimate_response);

  //(2) Ping tickets API
  let ticket_response = makeApiCall('tickets').tickets;
  ticket_response.forEach(function(value, index) {
    console.log(value);
  });
  
  }

//This Function builds the URL and options parameters to make the API. By inputing "type" you define whether or not your are going to make an estimate or ticket call
function makeApiCall(type, pagination){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tableValues = ss.getSheetByName("Controller").getRange(CONTROLLER_VALUES).getValues();
  var bearer_key = tableValues[0][1];
  var sub_domain = tableValues[1][1];

  if (type === 'tickets'){
    var URL = [
      "https://",
      sub_domain,
      ".repairshopr.com",
      "/api",
      "/v1",
      '/'+ type,
    ].join('');
  } 
  else if (type === 'estimates'){
    var URL = 
      ["https://",
      sub_domain,
      ".repairshopr.com",
      "/api",
      "/v1",
      '/'+ type,
    ].join(''); 
  }

  else{
    throw "URL not registering!";
  }

  options ={
    "method": "get",
    "contentType": "application/json",
    "headers": {
      "Authorization": "Bearer " + bearer_key
    }
  }

  if (pagination == True){
      response = JSON.parse(UrlFetchApp.fetch(URL, options));
      return response; 
  }
  else {
    //const entireTicketsList = await getEntireTicketList();
    //return entireTicketsList
  }
}




//GetTickets and getEntireTicketsList work in tandem to recursively call the repair shopr API and get the entire dataset. 
 function getTickets(pageNo=1){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tableValues = ss.getSheetByName("Controller").getRange(CONTROLLER_VALUES).getValues();
  var bearer_key = tableValues[0][1];
  var sub_domain = tableValues[1][1];
  let URL = `https://${sub_domain}.repairshopr.com/api/v1/tickets`
  options ={
    "method": "get",
    "contentType": "application/json",
    "headers": {
      "Authorization": "Bearer " + bearer_key
    }
  }

  let paginatedUrl = URL + `?page=${pageNo}`; 
  var apiResults = JSON.parse(UrlFetchApp.fetch(paginatedUrl, options))
  return apiResults; 
  }
function getEntireTicketsList(pageNo = 1) {
  var results = getTickets(pageNo);
  console.log("Retreiving data from API for page : " + pageNo);
  let x = results.tickets.length; 
  if (results.tickets.length>0){
    return results.concat(getEntireTicketsList(pageNo+1));
  } else {
    return results
  }
}



//This function writes data to rows given a row number and data value. The data value input is a dictionary that matches headers.
function writeRow(row, data_value){
  for (let [header, column] of Object.entries(RAWDATA_HEADER)) {
    let index = column + String(row); 
    let cell = RAW_DATA.getRange(index); 
    cell.setValue(data_value[header]); 
  }
}

*/
