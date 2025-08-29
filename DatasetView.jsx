import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Typography,
  Chip
} from '@mui/material';
import {
  Edit,
  Download,
  Share,
  Description,
  TableChart
} from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import DatasetOverview from './DatasetOverview';
import DataSourcesView from './DataSourcesView';

// Dummy data that matches DatasetDetails and DataSources structure
const dummyDatasetData = {
  id: 'DS-12345',
  title: 'Climate Data for 2023',
  description: 'Climate data collected throughout 2023 from various weather stations across the region. This dataset includes temperature, humidity, precipitation, and atmospheric pressure readings.',
  purposeDescription: 'Research and analysis of climate patterns and changes over time',
  tags: ['Climate', 'Weather', '2023', 'Environmental', 'Research'],
  updateFrequency: 'Monthly',
  owner: 'Dr. Amelia Bennett',
  steward: 'Climate Research Team',
  creator: 'Dr. Amelia Bennett',
  nfrRisk: 'Low',
  status: 'Active',
  inventoriedDate: '2023-01-15',
  creationDate: '2023-01-15',
  ddlcReviewedDate: '2023-02-20',
  documentationUrl: 'https://example.com/docs/climate2023',
  modifiedBy: 'Current User',
  modifiedDate: '2024-01-15',
  
  dataSources: [
    {
      id: 1,
      platform: 'LCD Datamart',
      database: 'nypd_icdmart',
      tables: [
        {
          name: 'arrests',
          columns: ['id', 'date', 'officer_id', 'charge', 'location']
        },
        {
          name: 'incidents',
          columns: ['incident_id', 'timestamp', 'type', 'severity', 'address']
        }
      ]
    },
    {
      id: 2,
      platform: 'AWS Redshift',
      database: 'redshift_prod',
      tables: [
        {
          name: 'customer_data',
          columns: ['id', 'name', 'email', 'phone', 'address']
        },
        {
          name: 'sales',
          columns: ['sale_id', 'date', 'amount', 'product_id', 'customer_id']
        }
      ]
    }
  ]
};

const DatasetView = () => {
  const { datasetId } = useParams();
  const [dataset, setDataset] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    // In a real application, this would fetch data based on datasetId
    setDataset(dummyDatasetData);
  }, [datasetId]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (!dataset) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        Loading dataset information...
      </Box>
    );
  }

  const statusColors = {
    Active: 'success',
    Inactive: 'default',
    Pending: 'warning',
    Deprecated: 'error',
    Terminated: 'error'
  };

  return (
    <Box sx={{ p: 3, backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header Section */}
      <Card sx={{ mb: 3, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="h4" fontWeight="600">
                {dataset.title}
              </Typography>
              <Chip 
                label={dataset.status} 
                color={statusColors[dataset.status] || 'default'} 
                size="medium"
              />
            </Box>
            <Box display="flex" gap={1}>
              <Tooltip title="Edit">
                <IconButton color="primary">
                  <Edit />
                </IconButton>
              </Tooltip>
              <Tooltip title="Download">
                <IconButton color="primary">
                  <Download />
                </IconButton>
              </Tooltip>
              <Tooltip title="Share">
                <IconButton color="primary">
                  <Share />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          
          <Box mb={2}>
            <Typography variant="h6" fontWeight="600" gutterBottom>
              Description
            </Typography>
            <Typography variant="body1">{dataset.description}</Typography>
          </Box>
          
          <Box mb={2}>
            <Typography variant="h6" fontWeight="600" gutterBottom>
              Purpose
            </Typography>
            <Typography variant="body1">{dataset.purposeDescription}</Typography>
          </Box>
          
          <Box>
            <Typography variant="h6" fontWeight="600" gutterBottom>
              Tags
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {dataset.tags.map((tag, index) => (
                <Chip key={index} label={tag} variant="outlined" size="small" />
              ))}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Tabs for different sections */}
      <Card sx={{ mb: 3, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="dataset tabs">
          <Tab icon={<Description />} label="Dataset Details" />
          <Tab icon={<TableChart />} label="Data Sources" />
        </Tabs>
      </Card>

      {/* Tab Content */}
      {tabValue === 0 && <DatasetOverview dataset={dataset} />}
      {tabValue === 1 && <DataSourcesView dataset={dataset} />}
    </Box>
  );
};

export default DatasetView;