import React, { useState } from "react";
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  GridLegacy as Grid,
  Card,
  CardContent,
  LinearProgress,
} from "@mui/material";
import { Dataset as DatasetIcon } from "@mui/icons-material";
import DatasetDetails from "./steps/DatasetDetails";
import DistributionDetails from "./steps/DistributionDetails";
import DataSources from "./steps/DataSources";
import DataServices from "./steps/DataServices";
import ReviewAndSubmit from "./steps/ReviewAndSubmit";

const steps = [
  "Dataset Details",
  "Distribution Details",
  "Data Sources",
  "Data Services",
  "Review & Submit",
];

const CreateDataset = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [stepValidity, setStepValidity] = useState({
    0: false,
    1: false,
    2: false,
    3: false,
  });

  // Initialize form data with empty objects
  const [formData, setFormData] = useState({
    datasetDetails: {},
    distributionDetails: [
      {
        id: "DIST-001",
        title: "",
        description: "",
        creationDate: "",
        creator: "",
        format: "",
        accessURL: "",
        downloadURL: "",
        updateFrequency: "",
        status: "",
      },
    ],
    dataSources: [],
    dataServices: [],
  });

  const handleNext = () => {
    // Mark current step as completed
    const newCompleted = new Set(completedSteps);
    newCompleted.add(activeStep);
    setCompletedSteps(newCompleted);

    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    // When going back, remove the current step from completed steps
    const newCompleted = new Set(completedSteps);
    newCompleted.delete(activeStep - 1);
    setCompletedSteps(newCompleted);

    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setCompletedSteps(new Set());
    setStepValidity({
      0: false,
      1: false,
      2: false,
      3: false,
    });
    setFormData({
      datasetDetails: {},
      distributionDetails: [
        {
          id: "DIST-001",
          title: "",
          description: "",
          creationDate: "",
          creator: "",
          format: "",
          accessURL: "",
          downloadURL: "",
          updateFrequency: "",
          status: "",
        },
      ],
      dataSources: [],
      dataServices: [],
    });
  };

  const updateStepValidity = (stepIndex, isValid) => {
    setStepValidity((prev) => ({
      ...prev,
      [stepIndex]: isValid,
    }));
  };

  const updateFormData = (step, data) => {
    setFormData((prev) => ({
      ...prev,
      [step]: data,
    }));
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <DatasetDetails
            data={formData.datasetDetails}
            onChange={(data) => updateFormData("datasetDetails", data)}
            onValidityChange={(isValid) => updateStepValidity(0, isValid)}
          />
        );
      case 1:
        return (
          <DistributionDetails
            data={formData.distributionDetails}
            onChange={(data) => updateFormData("distributionDetails", data)}
            onValidityChange={(isValid) => updateStepValidity(1, isValid)}
          />
        );
      case 2:
        return (
          <DataSources
            data={formData.dataSources}
            onChange={(data) => updateFormData("dataSources", data)}
            onValidityChange={(isValid) => updateStepValidity(2, isValid)}
          />
        );
      case 3:
        return (
          <DataServices
            data={formData.dataServices}
            onChange={(data) => updateFormData("dataServices", data)}
            onValidityChange={(isValid) => updateStepValidity(3, isValid)}
          />
        );
      case 4:
        return <ReviewAndSubmit data={formData} />;
      default:
        return "Unknown step";
    }
  };

  const isNextDisabled = activeStep < 4 && !stepValidity[activeStep];

  // Calculate progress percentage
  const progress = ((activeStep + 1) / steps.length) * 100;

  return (
    <Box
      sx={{
        width: "100%",
        backgroundColor: "#f5f5f5",
        minHeight: "100vh",
        p: 2,
      }}
    >
      {/* Progress Section - Only progress bar, no checkboxes or labels */}
      <Box sx={{ mb: 3, backgroundColor: "white", p: 2, borderRadius: 1 }}>
        {/* Header Section with Icon and Title */}
        <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
          <DatasetIcon sx={{ fontSize: 40, color: "primary.main", mr: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: "bold" }}>
            Create Dataset
          </Typography>
        </Box>

        {/* Progress Bar Only */}
        <Box sx={{ width: "100%" }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: "#e0e0e0",
              "& .MuiLinearProgress-bar": {
                borderRadius: 4,
                backgroundColor: "primary.main",
              },
            }}
          />
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Card sx={{ backgroundColor: "white" }}>
            <CardContent>
              {/* Vertical Stepper with default MUI numbering */}
              <Typography variant="h6" gutterBottom>
                Progress
              </Typography>
              <Typography
                variant="body2"
                color="textSecondary"
                gutterBottom
                sx={{ mb: 2 }}
              >
                Track your progress
              </Typography>
              <Stepper
                activeStep={activeStep}
                orientation="vertical"
                sx={{ mt: 2 }}
              >
                {steps.map((label, index) => (
                  <Step key={label} completed={completedSteps.has(index)}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={9}>
          <Card sx={{ backgroundColor: "white" }}>
            <CardContent>
              {getStepContent(activeStep)}

              <Box sx={{ display: "flex", flexDirection: "row", pt: 2 }}>
                <Button
                  color="inherit"
                  disabled={activeStep === 0}
                  onClick={handleBack}
                  sx={{ mr: 1 }}
                >
                  Back
                </Button>
                <Box sx={{ flex: "1 1 auto" }} />
                {activeStep === steps.length - 1 ? (
                  <Button onClick={handleReset}>Reset</Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    variant="contained"
                    disabled={isNextDisabled}
                  >
                    Next
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CreateDataset;
