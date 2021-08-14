Feature: A-GPS Data Fan Out (The cargo container scenario)

  In this scenario hundreds, or thousands of devices are unloaded from a steel
  walled cargo container (intermodal container). All of them connect to the 
  cellular network, and the same cell tower, and request A-GPS data, because
  they have been offline for weeks while being shipped over the ocean.
  
  While all devices should receive A-GPS data as per their request, we do not
  want to hammer to third-party API with thousands of requests for the same
  A-GPS data.

  Contexts:

    | device                   |
    | cargo container device 1 |
    | cargo container device 2 |

  Scenario: Register and connect device

    Given I am run after the "A-GPS" feature
    And I have a random UUID in "agpsDevice"
    And I generate a certificate for the tracker "{agpsDevice}"
    And I connect the tracker "{agpsDevice}"
    And I store "$millis()" into "updateShadowTs"
    And the tracker "{agpsDevice}" updates its reported state with
      """
      {
        "dev": {
          "v": {
            "iccid": "89882806660004909182",
            "modV": "mfw_nrf9160_1.0.0",
            "brdV": "thingy91_nrf9160",
            "appV": "0.14.6",
            "nw": "LTE-M GPS"
          },
          "ts": {updateShadowTs}
        }
      }
      """

  Scenario: Request A-GPS data

    When the tracker "{agpsDevice}" publishes this message to the topic {agpsDevice}/agps/get
      """
      {
        "mcc": {agpsMcc},
        "mnc": {agpsMnc},
        "cell": {agpsCellId},
        "area": {agpsArea},
        "types": [
          1,
          2,
          3,
          4,
          6,
          7,
          8,
          9
        ]
      }
      """
    Then the tracker "{agpsDevice}" receives 2 raw messages on the topic {agpsDevice}/agps into "agpsData"
    And  "$length($filter(agpsData, function($v) { $contains($v, '01010100f9fffffffeffffff0f7b12890612031f00017') })) > 0" should be true
    And  "$length($filter(agpsData, function($v) { $contains($v, '01021e0001006400c675009cff859f13000b0000c6753') })) > 0" should be true
    
  Scenario: Delete tracker
  
    Given I am authenticated with Cognito
    When I execute "listThingPrincipals" of the AWS Iot SDK with
      """
      {
        "thingName": "{agpsDevice}"
      }
      """
    Then "$count(awsSdk.res.principals)" should equal 1
    Given I store "awsSdk.res.principals[0]" into "certificateArn"
    Given I store "$split(awsSdk.res.principals[0], '/')[1]" into "certificateId"
    Given I execute "detachThingPrincipal" of the AWS Iot SDK with
      """
      {
        "thingName": "{agpsDevice}",
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
        "thingName": "{agpsDevice}"
      }
      """
