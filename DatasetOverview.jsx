import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  GridLegacy as Grid,
  Link,
  Divider
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
              {/* Update Frequency */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                <Box display="flex" alignItems="center">
                  <Update sx={{ mr: 1, color: "primary.main" }} />
                  <Typography variant="subtitle1" fontWeight="600">
                    Update Frequency:
                  </Typography>
                </Box>
                <Typography variant="body1">
                  {dataset.updateFrequency}
                </Typography>
              </Box>
              
              <Divider sx={{ mb: 3 }} />
              
              {/* NFR Risk */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                <Box display="flex" alignItems="center">
                  <Security sx={{ mr: 1, color: "primary.main" }} />
                  <Typography variant="subtitle1" fontWeight="600">
                    NFR Risk:
                  </Typography>
                </Box>
                <Chip 
                  label={dataset.nfrRisk} 
                  color={riskColors[dataset.nfrRisk] || "default"} 
                  size="small"
                />
              </Box>
              
              <Divider sx={{ mb: 3 }} />
              
              {/* Owner */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                <Box display="flex" alignItems="center">
                  <Person sx={{ mr: 1, color: "primary.main" }} />
                  <Typography variant="subtitle1" fontWeight="600">
                    Owner:
                  </Typography>
                </Box>
                <Typography variant="body1">
                  {dataset.owner}
                </Typography>
              </Box>
              
              <Divider sx={{ mb: 3 }} />
              
              {/* Steward */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                <Box display="flex" alignItems="center">
                  <Group sx={{ mr: 1, color: "primary.main" }} />
                  <Typography variant="subtitle1" fontWeight="600">
                    Steward:
                  </Typography>
                </Box>
                <Typography variant="body1">
                  {dataset.steward}
                </Typography>
              </Box>
              
              <Divider sx={{ mb: 3 }} />
              
              {/* Creator */}
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center">
                  <Badge sx={{ mr: 1, color: "primary.main" }} />
                  <Typography variant="subtitle1" fontWeight="600">
                    Creator:
                  </Typography>
                </Box>
                <Typography variant="body1">
                  {dataset.creator}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent>
              {/* Creation Date */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                <Box display="flex" alignItems="center">
                  <CalendarToday sx={{ mr: 1, color: "primary.main" }} />
                  <Typography variant="subtitle1" fontWeight="600">
                    Creation Date:
                  </Typography>
                </Box>
                <Typography variant="body1">
                  {dataset.creationDate}
                </Typography>
              </Box>
              
              <Divider sx={{ mb: 3 }} />
              
              {/* Inventoried Date */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                <Box display="flex" alignItems="center">
                  <Inventory sx={{ mr: 1, color: "primary.main" }} />
                  <Typography variant="subtitle1" fontWeight="600">
                    Inventoried Date:
                  </Typography>
                </Box>
                <Typography variant="body1">
                  {dataset.inventoriedDate}
                </Typography>
              </Box>
              
              <Divider sx={{ mb: 3 }} />
              
              {/* DDLC Reviewed Date */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                <Box display="flex" alignItems="center">
                  <Reviews sx={{ mr: 1, color: "primary.main" }} />
                  <Typography variant="subtitle1" fontWeight="600">
                    DDLC Reviewed Date:
                  </Typography>
                </Box>
                <Typography variant="body1">
                  {dataset.ddlcReviewedDate}
                </Typography>
              </Box>
              
              <Divider sx={{ mb: 3 }} />
              
              {/* Modified By */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                <Box display="flex" alignItems="center">
                  <EditCalendar sx={{ mr: 1, color: "primary.main" }} />
                  <Typography variant="subtitle1" fontWeight="600">
                    Modified By:
                  </Typography>
                </Box>
                <Typography variant="body1">
                  {dataset.modifiedBy}
                </Typography>
              </Box>
              
              <Divider sx={{ mb: 3 }} />
              
              {/* Modified Date */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                <Box display="flex" alignItems="center">
                  <CalendarToday sx={{ mr: 1, color: "primary.main" }} />
                  <Typography variant="subtitle1" fontWeight="600">
                    Modified Date:
                  </Typography>
                </Box>
                <Typography variant="body1">
                  {dataset.modifiedDate}
                </Typography>
              </Box>
              
              <Divider sx={{ mb: 3 }} />
              
              {/* Documentation */}
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center">
                  <LinkIcon sx={{ mr: 1, color: "primary.main" }} />
                  <Typography variant="subtitle1" fontWeight="600">
                    Documentation:
                  </Typography>
                </Box>
                <Link
                  href={dataset.documentationUrl}
                  target="_blank"
                  rel="noopener"
                >
                  View
                </Link>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DatasetOverview;
