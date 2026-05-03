export const handler = async (event) => {

  let messageData = {};
  try {
      messageData = JSON.parse(event.body || '{}');
  } catch (err) {
      return createResponse(400, { error: "Invalid JSON in message body" }, null);
  }

  const requestId = messageData?.requestId;
  const fileName = messageData?.fileName;
  const groupName = messageData?.groupName;
  const contentType = "image/png";
  
  const response = {
    statusCode: 200,
    body: JSON.stringify({ message: 'https://example.com', requestId }),
  };
  return response;
};
