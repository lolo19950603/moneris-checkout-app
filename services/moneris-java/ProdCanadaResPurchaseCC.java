import JavaAPI.*;
public class ProdCanadaResPurchaseCC
{
public static void main(String[] args)
{
String order_id = args[0];
String data_key  = args[1];
String amount = args[2];
String cust_id = args[3];
String store_id = System.getenv("MONERIS_STORE_ID");
String api_token = System.getenv("MONERIS_API_TOKEN");
String crypt_type = "7";
String processing_country_code = "CA";
boolean status_check = false;
ResPurchaseCC resPurchaseCC = new ResPurchaseCC();
resPurchaseCC.setData(data_key);
resPurchaseCC.setOrderId(order_id);
resPurchaseCC.setCustId(cust_id);
resPurchaseCC.setAmount(amount);
resPurchaseCC.setCryptType(crypt_type);
//resPurchaseCC.setDynamicDescriptor(descriptor);
//resPurchaseCC.setExpDate(expdate); //Temp Tokens only
//Mandatory - Credential on File details
CofInfo cof = new CofInfo();
cof.setPaymentIndicator("U");
cof.setPaymentInformation("2");
cof.setIssuerId("139X3130ASCXAS9");
resPurchaseCC.setCofInfo(cof);
HttpsPostRequest mpgReq = new HttpsPostRequest(); 
mpgReq.setProcCountryCode(processing_country_code);
mpgReq.setTestMode(false); //false or comment out this line for production transactions 
mpgReq.setStoreId(store_id);
mpgReq.setApiToken(api_token);
mpgReq.setTransaction(resPurchaseCC);
mpgReq.setStatusCheck(status_check); 
mpgReq.send();
try
{
Receipt receipt = mpgReq.getReceipt();
System.out.println("DataKey = " + receipt.getDataKey()); 
System.out.println("ReceiptId = " + receipt.getReceiptId()); 
System.out.println("ReferenceNum = " + receipt.getReferenceNum()); 
System.out.println("ResponseCode = " + receipt.getResponseCode()); 
System.out.println("AuthCode = " + receipt.getAuthCode()); 
System.out.println("Message = " + receipt.getMessage()); 
System.out.println("TransDate = " + receipt.getTransDate()); 
System.out.println("TransTime = " + receipt.getTransTime()); 
System.out.println("TransType = " + receipt.getTransType()); 
System.out.println("Complete = " + receipt.getComplete()); 
System.out.println("TransAmount = " + receipt.getTransAmount()); 
System.out.println("CardType = " + receipt.getCardType()); 
System.out.println("TxnNumber = " + receipt.getTxnNumber()); 
System.out.println("TimedOut = " + receipt.getTimedOut()); 
System.out.println("ResSuccess = " + receipt.getResSuccess()); 
System.out.println("PaymentType = " + receipt.getPaymentType()); 
System.out.println("IsVisaDebit = " + receipt.getIsVisaDebit()); 
System.out.println("Cust ID = " + receipt.getResCustId()); 
System.out.println("Phone = " + receipt.getResPhone()); 
System.out.println("Email = " + receipt.getResEmail()); 
System.out.println("Note = " + receipt.getResNote()); 
System.out.println("Masked Pan = " + receipt.getResMaskedPan()); 
System.out.println("Exp Date = " + receipt.getResExpdate()); 
System.out.println("Crypt Type = " + receipt.getResCryptType()); 
System.out.println("Avs Street Number = " + receipt.getResAvsStreetNumber()); 
System.out.println("Avs Street Name = " + receipt.getResAvsStreetName()); 
System.out.println("Avs Zipcode = " + receipt.getResAvsZipcode()); 
System.out.println("IssuerId = " + receipt.getIssuerId());
}
catch (Exception e)
{
e.printStackTrace();
}
}
}