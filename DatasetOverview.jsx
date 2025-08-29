import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  GridLegacy as Grid,
  Link
} from "@mui/material";
import {
  CalendarToday,
  Person,
  Security,
  Group,
  Inventory,
  Reviews,
  EditCalendar,
  Badge,
  Update,
  Link as LinkIcon
} from "@mui/icons-material";

const DatasetOverview = ({ dataset }) => {
  const statusColors = {
    Active: "success",
    Inactive: "default",
    Pending: "warning",
    Deprecated: "error",
    Terminated: "error",
  };

  const riskColors = {
    Low: "success",
    Medium: "warning",
    High: "error",
  };

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Left Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Update sx={{ mr: 1, color: "primary.main" }} />
                <Typography variant="h6" fontWeight="600">
                  Update Frequency
                </Typography>
              </Box>
              <Typography variant="body1" mb={3}>
                {dataset.updateFrequency}
              </Typography>
              
              <Box display="flex" alignItems="center" mb={2}>
                <Security sx={{ mr: 1, color: "primary.main" }} />
                <Typography variant="h6" fontWeight="600">
                  NFR Risk
                </Typography>
              </Box>
              <Chip 
                label={dataset.nfrRisk} 
                color={riskColors[dataset.nfrRisk] || "default"} 
                size="medium"
                sx={{ mb: 3 }}
              />
              
              <Box display="flex" alignItems="center" mb={2}>
                <Person sx={{ mr: 1, color: "primary.main" }} />
                <Typography variant="h6" fontWeight="600">
                  Owner
                </Typography>
              </Box>
              <Typography variant="body1" mb={3}>
                {dataset.owner}
              </Typography>
              
              <Box display="flex" alignItems="center" mb={2}>
                <Group sx={{ mr: 1, color: "primary.main" }} />
                <Typography variant="h6" fontWeight="600">
                  Steward
                </Typography>
              </Box>
              <Typography variant="body1" mb={3}>
                {dataset.steward}
              </Typography>
              
              <Box display="flex" alignItems="center" mb={2}>
                <Badge sx={{ mr: 1, color: "primary.main" }} />
                <Typography variant="h6" fontWeight="600">
                  Creator
                </Typography>
              </Box>
              <Typography variant="body1">
                {dataset.creator}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <CalendarToday sx={{ mr: 1, color: "primary.main" }} />
                <Typography variant="h6" fontWeight="600">
                  Creation Date
                </Typography>
              </Box>
              <Typography variant="body1" mb={3}>
                {dataset.creationDate}
              </Typography>
              
              <Box display="flex" alignItems="center" mb={2}>
                <Inventory sx={{ mr: 1, color: "primary.main" }} />
                <Typography variant="h6" fontWeight="600">
                  Inventoried Date
                </Typography>
              </Box>
              <Typography variant="body1" mb={3}>
                {dataset.inventoriedDate}
              </Typography>
              
              <Box display="flex" alignItems="center" mb={2}>
                <Reviews sx={{ mr: 1, color: "primary.main" }} />
                <Typography variant="h6" fontWeight="600">
                  DDLC Reviewed Date
                </Typography>
              </Box>
              <Typography variant="body1" mb={3}>
                {dataset.ddlcReviewedDate}
              </Typography>
              
              <Box display="flex" alignItems="center" mb={2}>
                <EditCalendar sx={{ mr: 1, color: "primary.main" }} />
                <Typography variant="h6" fontWeight="600">
                  Modified By
                </Typography>
              </Box>
              <Typography variant="body1" mb={3}>
                {dataset.modifiedBy}
              </Typography>
              
              <Box display="flex" alignItems="center" mb={2}>
                <CalendarToday sx={{ mr: 1, color: "primary.main" }} />
                <Typography variant="h6" fontWeight="600">
                  Modified Date
                </Typography>
              </Box>
              <Typography variant="body1" mb={3}>
                {dataset.modifiedDate}
              </Typography>
              
              <Box display="flex" alignItems="center" mb={2}>
                <LinkIcon sx={{ mr: 1, color: "primary.main" }} />
                <Typography variant="h6" fontWeight="600">
                  Documentation
                </Typography>
              </Box>
              <Link
                href={dataset.documentationUrl}
                target="_blank"
                rel="noopener"
              >
                View Documentation
              </Link>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DatasetOverview;