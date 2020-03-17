Feature: Cell Geolocation

    GPS fixes will be stored with the cell id
    so that the UI can show an approximate tracker location
    based on the cell id even if a device has no current GPS fix

    Background:

        Given I am run after the "Connect a Cat Tracker" feature
        And I am run after the "Device: Update Shadow" feature

    Scenario: Device enters a cell

        Given I store "$floor($random() * 100000000)" into "cellId"
        And I store "$random() * 90" into "lat"
        And I store "$random() * 180" into "lng"
        Then the cat tracker updates its reported state with
            """
            {
            "roam": {
            "v": {
            "rsrp": 0,
            "area": 211,
            "mccmnc": 26201,
            "cell": {cellId},
            "ip": "10.202.80.9"
            },
            "ts": 1572340608948
            }
            }
            """

    Scenario: Device acquires a GPS fix

        Given the cat tracker updates its reported state with
            """
            {
            "gps": {
            "v": {
            "lng": {lng},
            "lat": {lat},
            "acc": 18.625809,
            "alt": 443.635193,
            "spd": 0.448984,
            "hdg": 0
            },
            "ts": 1572340324000
            }
            }
            """

    Scenario: User can start the step function to resolve the cell

        Given I am authenticated with Cognito
        When I execute "startExecution" of the AWS StepFunctions SDK with
            """
            {
                "stateMachineArn": "{cellGeoStateMachineArn}",
                "input": "{\"area\":211,\"mccmnc\":26201,\"cell\":{cellId}}"
            }
            """
        Then "$length(awsSdk.res.executionArn) > 0" should be true
        And I store "awsSdk.res.executionArn" into "executionArn"

    Scenario: User can query the step function execution

        Given I am authenticated with Cognito
        When I execute "describeExecution" of the AWS StepFunctions SDK with
            """
            {
                "executionArn": "{executionArn}"
            }
            """
        Then "awsSdk.res" should match this JSON
            """
            {
                "executionArn": "{executionArn}",
                "stateMachineArn": "{cellGeoStateMachineArn}",
                "status": "SUCCEEDED",
                "input": "{\"area\":211,\"mccmnc\":26201,\"cell\":{cellId}}",
                "output": "{\"area\":211,\"mccmnc\":26201,\"cell\":{cellId},\"cellgeo\":{\"located\":true,\"lat\":{lat},\"lng\":{lng},\"accuracy\":5000},\"storedInCache\":true}"
            }
            """

    Scenario: User can resolve the cell using the cache table

        Given I am authenticated with Cognito
        When I execute "getItem" of the AWS DynamoDB SDK with
            """
            {
                "TableName": "{cellGeoLocationsCacheTable}",
                "Key": {
                    "cellId": {
                        "S": "{cellId}-26201-211"
                    }
                },
                "ProjectionExpression": "lat,lng,accuracy"
            }
            """
        Then "awsSdk.res.Item" should equal this JSON
            """
            {
                "lat": {
                    "N": "{lat}"
                },
                "lng": {
                    "N": "{lng}"
                },
                "accuracy": {
                    "N": "5000"
                }
            }
            """
