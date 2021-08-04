Feature: P-GPS Data Fan Out (The cargo container scenario)

  In this scenario hundreds, or thousands of devices are unloaded from a steel
  walled cargo container (intermodal container). All of them connect to the 
  cellular network, and the same cell tower, and request P-GPS data, because
  they have been offline for weeks while being shipped over the ocean.
  
  While all devices should receive P-GPS data as per their request, we do not
  want to hammer to third-party API with thousands of requests for the same
  P-GPS data.

  Contexts:

    | device                   |
    | cargo container device 1 |
    | cargo container device 2 |

  Scenario: Register and connect device

    Given I am run after the "P-GPS" feature
    And I have a random UUID in "pgpsDevice"
    And I generate a certificate for the tracker "{pgpsDevice}"
    And I connect the tracker "{pgpsDevice}"

  Scenario: Request P-GPS data

    When the tracker "{pgpsDevice}" publishes this message to the topic {pgpsDevice}/pgps/get
      """
      {
        "n": {predictionCount},
        "time": {startGpsTimeOfDaySeconds}
      }
      """
    Then the tracker "{pgpsDevice}" receives a messages on the topic {pgpsDevice}/pgps into "pgpsData"
    And "pgpsData" should match this JSON
      """
      {
        "path": "public/15131-0_15135-72000.bin",
        "host": "pgps.nrfcloud.com"
      }
      """
    
  Scenario: Delete tracker
  
    Given I am authenticated with Cognito
    When I execute "listThingPrincipals" of the AWS Iot SDK with
      """
      {
        "thingName": "{pgpsDevice}"
      }
      """
    Then "$count(awsSdk.res.principals)" should equal 1
    Given I store "awsSdk.res.principals[0]" into "certificateArn"
    Given I store "$split(awsSdk.res.principals[0], '/')[1]" into "certificateId"
    Given I execute "detachThingPrincipal" of the AWS Iot SDK with
      """
      {
        "thingName": "{pgpsDevice}",
        "principal": "{certificateArn}"
      }
      """
    And I execute "updateCertificate" of the AWS Iot SDK with
      """
      {
        "certificateId": "{certificateId}",
        "newStatus": "INACTIVE"
      }
      """
    And I execute "deleteCertificate" of the AWS Iot SDK with
      """
      {
        "certificateId": "{certificateId}"
      }
      """
    And I execute "deleteThing" of the AWS Iot SDK with
      """
      {
        "thingName": "{pgpsDevice}"
      }
      """
