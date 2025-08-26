import React, { useState } from 'react';
import {
  Box,
  Typography,
  GridLegacy as Grid,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Divider
} from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const ReviewAndSubmit = ({ data }) => {
  const navigate = useNavigate();
  const [openDialog, setOpenDialog] = useState(false);

  const handleSubmit = () => {
    // Save to localStorage (simulating API call)
    const datasets = JSON.parse(localStorage.getItem('datasets') || '[]');
    const newDataset = {
      id: data.datasetDetails?.id || `DS-${Date.now()}`,
      title: data.datasetDetails?.title || '',
      owner: data.datasetDetails?.owner || '',
      status: data.datasetDetails?.status || '',
      modified: new Date().toISOString().split('T')[0],
      // Add all fields for proper storage
      ...data.datasetDetails,
      distributions: data.distributionDetails || [],
      dataSources: data.dataSources || [],
      dataServices: data.dataServices || []
    };
    
    datasets.push(newDataset);
    localStorage.setItem('datasets', JSON.stringify(datasets));
    
    // Close dialog and navigate to dashboard
    setOpenDialog(false);
    navigate('/');
  };

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  // Get data from props or use empty objects as fallback
  const datasetData = data.datasetDetails || {};
  const distributions = data.distributionDetails || [];
  const dataSources = data.dataSources || [];
  const dataServices = data.dataServices || [];

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Review & Submit
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        Review all information before submitting
      </Typography>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* Dataset Details */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Dataset Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2"><strong>Dataset ID:</strong> {datasetData.id || 'Not specified'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2"><strong>Modified By:</strong> {datasetData.modifiedBy || 'Not specified'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2"><strong>Modified Date:</strong> {formatDate(datasetData.modifiedDate)}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2"><strong>Title:</strong> {datasetData.title || 'Not specified'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2">
                    <strong>Status:</strong> 
                    <Chip 
                      label={datasetData.status || 'Not specified'} 
                      color={datasetData.status === 'Active' ? 'success' : 'default'} 
                      size="small" 
                      sx={{ ml: 1 }} 
                    />
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2"><strong>Owner:</strong> {datasetData.owner || 'Not specified'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2"><strong>Steward:</strong> {datasetData.steward || 'Not specified'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2"><strong>Creator:</strong> {datasetData.creator || 'Not specified'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2"><strong>Update Frequency:</strong> {datasetData.updateFrequency || 'Not specified'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2"><strong>NFR Risk:</strong> {datasetData.nfrRisk || 'Not specified'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2"><strong>Inventoried Date:</strong> {formatDate(datasetData.inventoriedDate)}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2"><strong>Creation Date:</strong> {formatDate(datasetData.creationDate)}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2"><strong>DDLC Reviewed Date:</strong> {formatDate(datasetData.ddlcReviewedDate)}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2"><strong>Description:</strong> {datasetData.description || 'Not specified'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2"><strong>Purpose:</strong> {datasetData.purposeDescription || 'Not specified'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2"><strong>Tags:</strong> {datasetData.tags || 'Not specified'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2">
                    <strong>Documentation URL:</strong> {datasetData.documentationUrl ? (
                      <a href={datasetData.documentationUrl} target="_blank" rel="noopener noreferrer">
                        {datasetData.documentationUrl}
                      </a>
                    ) : 'Not specified'}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Distributions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Distributions ({distributions.length})
              </Typography>
              {distributions.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  No distributions added
                </Typography>
              ) : (
                distributions.map((dist, index) => (
                  <Box key={dist.id || index} sx={{ mb: 3, p: 2, border: '1px solid #eee', borderRadius: 1 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Distribution {index + 1}: {dist.title || 'Untitled'}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Distribution ID:</strong> {dist.id || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Modified Date:</strong> {formatDate(dist.modifiedDate)}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="body2"><strong>Description:</strong> {dist.description || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Format:</strong> {dist.format || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Creation Date:</strong> {formatDate(dist.creationDate)}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Creator:</strong> {dist.creator || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Update Frequency:</strong> {dist.updateFrequency || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2">
                          <strong>Status:</strong> 
                          <Chip 
                            label={dist.status || 'Not specified'} 
                            color={dist.status === 'Active' ? 'success' : 'default'} 
                            size="small" 
                            sx={{ ml: 1 }} 
                          />
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2">
                          <strong>Access URL:</strong> {dist.accessURL ? (
                            <a href={dist.accessURL} target="_blank" rel="noopener noreferrer">
                              {dist.accessURL}
                            </a>
                          ) : 'Not specified'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2">
                          <strong>Download URL:</strong> {dist.downloadURL ? (
                            <a href={dist.downloadURL} target="_blank" rel="noopener noreferrer">
                              {dist.downloadURL}
                            </a>
                          ) : 'Not specified'}
                        </Typography>
                      </Grid>
                    </Grid>
                    {index < distributions.length - 1 && <Divider sx={{ mt: 2 }} />}
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Data Sources */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Data Sources ({dataSources.length})
              </Typography>
              {dataSources.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  No data sources added
                </Typography>
              ) : (
                dataSources.map((source, index) => (
                  <Box key={source.id || index} sx={{ mb: 3, p: 2, border: '1px solid #eee', borderRadius: 1 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Data Source {index + 1}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Platform:</strong> {source.platform || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Schema:</strong> {source.schema || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Database:</strong> {source.database || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Table:</strong> {source.table || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Column:</strong> {source.column || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>File:</strong> {source.file || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Data Elements:</strong> {source.dataElements || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Collibra Elements:</strong> {source.collibraElements || 'Not specified'}</Typography>
                      </Grid>
                    </Grid>
                    {index < dataSources.length - 1 && <Divider sx={{ mt: 2 }} />}
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Data Services */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Data Services ({dataServices.length})
              </Typography>
              {dataServices.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  No data services added
                </Typography>
              ) : (
                dataServices.map((service, index) => (
                  <Box key={service.id || index} sx={{ mb: 3, p: 2, border: '1px solid #eee', borderRadius: 1 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Data Service {index + 1}: {service.title || 'Untitled'}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Data Service ID:</strong> {service.id || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Modified Date:</strong> {formatDate(service.modifiedDate)}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="body2"><strong>Description:</strong> {service.description || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Creation Date:</strong> {formatDate(service.creationDate)}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Creator:</strong> {service.creator || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Hosted By:</strong> {service.hostedBy || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Modified By:</strong> {service.modifiedBy || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2"><strong>Service Type:</strong> {service.serviceType || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2">
                          <strong>Endpoint:</strong> {service.endpoint ? (
                            <a href={service.endpoint} target="_blank" rel="noopener noreferrer">
                              {service.endpoint}
                            </a>
                          ) : 'Not specified'}
                        </Typography>
                      </Grid>
                    </Grid>
                    {index < dataServices.length - 1 && <Divider sx={{ mt: 2 }} />}
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Box display="flex" justifyContent="center" mt={2}>
            <Button variant="contained" size="large" startIcon={<CheckCircle />} onClick={handleOpenDialog}>
              Submit Dataset
            </Button>
          </Box>
        </Grid>
      </Grid>

      {/* Confirmation Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Confirm Submission</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to submit this dataset? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReviewAndSubmit;