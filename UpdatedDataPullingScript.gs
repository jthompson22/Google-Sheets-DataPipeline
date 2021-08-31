// CONTROLLER CELLS:
const CONTROLLER_VALUES= "A9:B12";
const CONTROLLER_MATRIX = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Controller").getRange(CONTROLLER_VALUES).getValues();
const BEARER_KEY = CONTROLLER_MATRIX[0][1];
const SUB_DOMAIN = CONTROLLER_MATRIX[1][1]; 
const SPREADSHEET_ID = CONTROLLER_MATRIX[2][1];
const SHEET_ID = CONTROLLER_MATRIX[3][1]
const RAW_TICKET_DATA = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("RawTicketData");
const RAW_ESTIMATE_DATA = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("RawEstimateData");
const RAW_MASTER_DATA = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("RawEstimateData");


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
const COLUMNS = [
  'TICKETID',
  'TICKET#',	
  'NAME',
  'DAYS',
  'DIAGNOSE',,
  'ESTIMATE',	
  'APPROVED',
  'COMPLETED',	
  'DATE ADDED',	
  'STATUS',
  'LAST UPDATED',
  'TECH',
]

function joinEstimateDataToTicketData(){
  //get estimate data; transform data into a dictionary to with key == ticket_id

  let estimates = RAW_ESTIMATE_DATA.getDataRange().getValues();
  estimates.splice(0,1);
  let tickets = RAW_TICKET_DATA.getDataRange().getValues(); 
  tickets.splice(0,1);

  let estimates_dictionary = Object.assign({}, ...estimates.map((x) => ({[x[11]]: [...x]})));
  let ticket_dictionary = Object.assign({}, ...tickets.map((x) => ({[x[0]]: [...x]})));

  let est_len = Object.keys(estimates_dictionary).length;
  let tic_len = Object.keys(ticket_dictionary).length; 

  Object.entries(estimates_dictionary).forEach(function([key, value]){
    let tic_len_2 = Object.keys(ticket_dictionary).length; 
    if (ticket_dictionary.hasOwnProperty(key)){
      if(value[5]){
        temp_array = [...ticket_dictionary[key]]
        estimate_createdAt = new Date(value[5]);
        temp_array[10] = estimate_createdAt;
        //ticket_dictionary[key] = ticket_dictionary[key].push(estimate_createdAt)
        if(value[4]){
          if(value[4] === 'Approved')
          {
            updated_at = new Date(value[4])
            //ticket_dictionary[key] = ticket_dictionary[key].push(updated_at);
            temp_array[11] = estimate_createdAt;
          }
          else if (value[4]==='Declined')
          {
            //ticket_dictionary[key] = ticket_dictionary[key].push('Rejected');
            temp_array[11] = 'Declined'
          }
        }
        ticket_dictionary[key] = temp_array;
      }  
    } 
  });

  let joined_data = [...Object.values(ticket_dictionary)]
  writeAllJoinedData(SPREADSHEET_ID, joined_data)
}

function addEstimateDataToSpreadSheet(){
  let temp_estimates = getEntireEstimatesList(pageNo=1, limit=false)
  let estimates =[]
  temp_estimates.forEach(function(value, index){
    estimates.push(Object.values(value))
  })
  writeAllEstimateData(SPREADSHEET_ID, estimates)
}


//SCRIPT EXECUTION FUNCTIONS:
function executeTickets(){
  let final_data = syncData();
  //RAW_TICKET_DATA.getRange("A2:L").clearContent(); 
  writeAllTicketData(SPREADSHEET_ID, final_data);
}

//
function executeEstimates(){
  let estimate_data = getEntireEstimatesList(page = 1, limit = false)
  let esimates_dictionary = {}
  estimate_data.forEach(function(value, index){
    let id = value["ticket_id"];
    estimates_dictionary[id] = value; 
  }); 
  return estimates_dictionary; 
}


function syncData(){
  let final_data = []

  //(1) Make an API call to the Repair Shopper and return arrays of all estimates and all tickets
  let tickets = getEntireTicketsList(pageNo = 1, limit=false); 

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
        
    //(2B)IF their is a property called "dated_added" and resolve at does not exist: today - date added; ELSE  IF both exist: resolved_at -        date_added; ElSE: empty string; 
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
      days = 'NULL';
    }

    //(2D) create a temporary dictionary with items corrpesonding to properties. 
    temp_dic = {
      "TICKETID": value['id'],
      "TICKET#": value['number'],
      "NAME": value['customer_business_then_name'],
      "DAYS":  days, 
      "DIAGNOSE": diagnose,
      "COMPLETED": new Date(value?.["resolved_at"]),
      "DATE ADDED": date_added,
      "STATUS": value['status'],
      "LAST UPDATED": new Date(value?.['updated_at']),
      "TECH": value?.user?.full_name,
      "ESTIMATE": '',
      "APPROVED": ''
    }
    
    final_data.push(Object.values(temp_dic));
  });
  
  return final_data; 
}


function test(){
  let estimates = getEntireEstimatesList(pageNo=1, limit=true)
  let dictionary = Object.assign({}, ...estimates.map((x) => ({[x.ticket_id]: {...x}})))

  console.log(dictionary)
}


//HELPER FUNCTIONS BELOW:

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

function getEntireTicketsList(pageNo = 1, limit) {
  if (limit)
  {
    var results = getTickets(pageNo);
    console.log("Retreiving data from API for page : " + pageNo);
    if(pageNo < 3){
      return results.tickets.concat(getEntireTicketsList(pageNo+1, limit=true));
    } else {
      return results.tickets
    }
  }else{
    var results = getTickets(pageNo);
    console.log("Retreiving data from API for page : " + pageNo);
    let x = results.tickets.length; 
    if (results.tickets.length>0){
      return results.tickets.concat(getEntireTicketsList(pageNo+1));
    } else {
      return results.tickets
    }
  }
}

function writeAllTicketData(spreadsheetId, data) {
  var columnAValues = [
    ['TICKETID', 'Ticket#', 'NAME' , 'DAYS', 'DIAGNOSE', 'COMPLETED', 'DATE ADDED', 'STATUS', 'LAST UPDATED', 'TECH', 'ESTIMATE', 'APPROVED', 'QUICK NOTES']
  ];
  var rowValues = data;
  var request = {
    'valueInputOption': 'USER_ENTERED',
    'data': [
      {
        'range': 'RawTicketData!A2:M',
        'majorDimension': 'COLUMNS',
        'values': columnAValues
      },
      {
        'range': 'RawTicketData!A2:M',
        'majorDimension': 'ROWS',
        'values': rowValues
      }
    ]
  };
  var response = Sheets.Spreadsheets.Values.batchUpdate(request, spreadsheetId);
  console.log(response);
}

function writeAllJoinedData(spreadsheetId, data) {
  var columnAValues = [
    ['TICKETID', 'Ticket#', 'NAME' , 'DAYS', 'DIAGNOSE', 'COMPLETED', 'DATE ADDED', 'STATUS', 'LAST UPDATED', 'TECH', 'ESTIMATE', 'APPROVED', 'QUICK NOTES']
  ];
  var rowValues = data;
  var request = {
    'valueInputOption': 'USER_ENTERED',
    'data': [
      {
        'range': 'RawMaster!A2:M',
        'majorDimension': 'COLUMNS',
        'values': columnAValues
      },
      {
        'range': 'RawMaster!A2:M',
        'majorDimension': 'ROWS',
        'values': rowValues
      }
    ]
  };
  var response = Sheets.Spreadsheets.Values.batchUpdate(request, spreadsheetId);
  console.log(response);
}

function writeAllEstimateData(spreadsheetId, data) {
  var columnAValues = [
    ['ID',	'CUSTOMER_ID',	'CUSTOMER_BUSSINES_THEN_NAME',	'NUMBER',	'STATUS',	'CREATED_AT',	'UPDATED_AT',	'DATE',	'SUBTOTAL',	'TOTAL',	'TAX', 'TICKET_ID',	'PDF_URL',	'LOCATION_ID',	'INVOICE_ID',	'EMPLOYEE']								
  ];
  var rowValues = data;
  var request = {
    'valueInputOption': 'USER_ENTERED',
    'data': [
      {
        'range': 'RawEstimateData!A2:P',
        'majorDimension': 'COLUMNS',
        'values': columnAValues
      },
      {
        'range': 'RawEstimateData!A2:P',
        'majorDimension': 'ROWS',
        'values': rowValues
      }
    ]
  };
  var response = Sheets.Spreadsheets.Values.batchUpdate(request, spreadsheetId);
  console.log(response);
}



function getEstimate(estimate_id){
  let URL = `https://${SUB_DOMAIN}.repairshopr.com/api/v1/estimates`
  options ={
    "method": "get",
    "contentType": "application/json",
    "headers": {
      "Authorization": "Bearer " + BEARER_KEY
    }
  }

  let paginatedUrl = URL + `/${estimate_id}`; 
  var apiResults = JSON.parse(UrlFetchApp.fetch(paginatedUrl, options));
  return apiResults; 
}

//GetTickets and getEntireTicketsList work in tandem to recursively call the repair shopr API and get the entire dataset. 
function getEstimates(pageNo=1){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tableValues = ss.getSheetByName("Controller").getRange(CONTROLLER_VALUES).getValues();
  var bearer_key = tableValues[0][1];
  var sub_domain = tableValues[1][1];
  let URL = `https://${sub_domain}.repairshopr.com/api/v1/estimates`
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

function getEntireEstimatesList(pageNo = 1, limit) {
  if (limit)
  {
    var results = getEstimates(pageNo);
    console.log("Retreiving data from API for page : " + pageNo);
    if(pageNo < 3){
      return results.estimates.concat(getEntireEstimatesList(pageNo+1, limit=true));
    } else {
      return results.estimates
    }
  }else{
    var results = getEstimates(pageNo);
    console.log("Retreiving data from API for page : " + pageNo);
    let x = results.estimates.length; 
    if (results.estimates.length>0){
      return results.estimates.concat(getEntireEstimatesList(pageNo+1));
    } else {
      return results.estimates
    }
  }
}

