@Only
Feature: Unwired Labs Cell Geolocation (NB-IoT)

    Depending on the network mode, use a different radio mode for Unwired Labs

    Background:

        This enques a mock response on the mock HTTP API the stack is configure
        to use for the Unwired Labs integration

        Given I am run after the "Unwired Labs Cell Geolocation" feature
        And the endpoint is "{geolocationApiUrl}"
        Given I store "$floor($random() * 100000000)" into "cellId"
        And I store "$floor($random() * 20000)" into "accuracy"
        And I store "$random() * 90" into "lat"
        And I store "$random() * 180" into "lng"
        Given I enqueue this mock HTTP API response with status code 200 for a POST request to /unwiredlabs/v2/process.php
        """
        {
            "accuracy": {accuracy},
            "balance": 100,
            "fallback": "ncf",
            "lat": {lat},
            "lon": {lng},
            "status": "ok"
        }
        """
            
    Scenario: Query the cell

        Given I store "$millis()" into "ts"
        When I GET /cell?cell={cellId}&area=30401&mccmnc=24201&nw=nbiot&ts={ts}
        Then the response status code should be 200
        And the response Access-Control-Allow-Origin should be "*"
        And the response Content-Type should be "application/json"
        And the response should equal this JSON
            """
            {
            "accuracy": {accuracy},
            "lat": {lat},
            "lng": {lng}
            }
            """

    Scenario: The Unwired Labs API should have been called

        Then the mock HTTP API should have been call with a POST request to /unwiredlabs/v2/process.php
        """
        {
            "token": "my-secret",
            "radio": "nbiot",
            "mcc": 242,
            "mnc": 1,
            "cells": [
                {
                "lac": 30401,
                "cid": {cellId}
                }
            ]
        }
        """