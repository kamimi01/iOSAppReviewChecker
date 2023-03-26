// TODO: JWTトークンの生成が失敗する（private key周りで失敗）
function main() {
  const TOPIC_GEN_APP_ID = "1673161138";
  const FRIEND_MANAGE_APP_ID = "1668244395";

  const token = getToken_();
  const apps = [TOPIC_GEN_APP_ID, FRIEND_MANAGE_APP_ID];

  const responses = getReviewStatus_(token, apps);

  const content = generateText_(responses);
  postToSlack_(content);
}

/**
 * JWTトークンを取得する
 */
function getToken_() {
  // let token = PropertiesService.getScriptProperties().getProperty("APP_STORE_CONNECT_API_TOKEN");
  let token = "enter JWT"
  if (token != "" && token != null) {
    return token;
  }

  const issuerID = PropertiesService.getScriptProperties().getProperty("ISSUER_ID");
  const keyID = PropertiesService.getScriptProperties().getProperty("KEY_ID");
  // const privateKey = PropertiesService.getScriptProperties().getProperty("PRIVATE_KEY");
  const privateKey = `-----BEGIN PRIVATE KEY-----
line1
line2
line3
line4
-----END PRIVATE KEY-----
`
  const header = Utilities.base64Encode(JSON.stringify({
    "alg": "ES256",
    "kid": keyID,
    "typ": "JWT"
  }), Utilities.Charset.UTF_8);
  const claimSet = JSON.stringify({
    "iss": issuerID,
    "ias": Math.floor(Date.now() / 1000),
    "exp": Math.floor(Date.now() / 1000 + 20 * 60),
    "aud": "appstoreconnect-v1"
  });
  const encodeText = header + "." + Utilities.base64Encode(claimSet, Utilities.Charset.UTF_8);
  const signature = Utilities.computeRsaSha256Signature(encodeText, privateKey);
  const newToken = encodeText + "." + Utilities.base64Encode(signature);
  console.log(newToken);

  PropertiesService.getScriptProperties().setProperty("APP_STORE_CONNECT_API_TOKEN", newToken);

  return newToken;
}

/**
 * App Store Connect API の /v1/reviewSubmissions にリクエストして、レビューステータスを取得する
 */
function getReviewStatus_(token, apps) {

  let responses = [];
  for (const app of apps) {
    let response = requestAppStoreConnectAPI_(token, app)

    if (response.errors != null) {
      const newToken = getToken_();
      response = requestAppStoreConnectAPI_(newToken, app);
    }

    responses.push(response);
  }

  return responses;
}

/**
 * App Store Connect API の /v1/reviewSubmissions にリクエスト
 */
function requestAppStoreConnectAPI_(token, app) {
  let url = "https://api.appstoreconnect.apple.com/v1/reviewSubmissions";
  url = url + "?" + "filter[app]" + "=" + app;
  url = url + "&" + "filter[platform]" + "=" + "IOS";
  url = url + "&" + "limit" + "=" + "1";

  const options = {
    'muteHttpExceptions' : true,
    "method": "GET",
    "headers": {"Authorization": `Bearer ${token}`}
  }

  return JSON.parse(UrlFetchApp.fetch(url, options).getContentText())
}

/**
 * Slack に投稿するテキストに加工する
 */
function generateText_(responses) {
  let topicGenContent = "[TopicGen]\n"
  let friendManageContent = "\n\n[ふれまね]\n"

  for (const [index, response] of responses.entries()) {
    if (index == 0) {
      if (response.errors != null) {
        const errorTitle = response.errors[0].title
        const errorDetail = response.errors[0].detail
        topicGenContent = topicGenContent + "エラーが発生しました。\n" + errorTitle + "\n" + errorDetail;
      } else {
        const submittedDate = response.data[0].attributes.submittedDate;
        const status = response.data[0].attributes.state;
        topicGenContent = topicGenContent + "\n提出日時：" + submittedDate;
        topicGenContent = topicGenContent + "\nステータス：" + status;        
      }
    }

    if (index == 1) {
      if (response.errors != null) {
        const errorTitle = response.errors[0].title
        const errorDetail = response.errors[0].detail
        friendManageContent = friendManageContent + "エラーが発生しました。\n" + errorTitle + "\n" + errorDetail;
      } else {
        const submittedDate = response.data[0].attributes.submittedDate;
        const status = response.data[0].attributes.state;
        friendManageContent = friendManageContent + "\n提出日時：" + submittedDate;
        friendManageContent = friendManageContent + "\nステータス：" + status;
      }
    }
  } 
  
  return topicGenContent + friendManageContent;
}

/**
 * Slack に投稿する
 */
function postToSlack_(content) {
  const url = "https://slack.com/api/chat.postMessage"

  const token = PropertiesService.getScriptProperties().getProperty("SLACK_BOT_TOKEN");
  const channelID = PropertiesService.getScriptProperties().getProperty("SLACK_CHANNEL_ID")
  const message = {
    "token": token,
    "text": content,
    "channel": channelID
  }
  const payload = JSON.stringify(message);
  const options = {
    method: "post",
    contentType: "application/json",
    payload: payload,
    headers: { "Authorization": `Bearer ${token}` }
  }

  const response = UrlFetchApp.fetch(url, options);
  console.log(response.getContentText())
}