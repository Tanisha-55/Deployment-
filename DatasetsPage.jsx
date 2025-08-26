import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Checkbox,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
  TextField,
  InputAdornment,
  Grid,
  Chip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

const DatasetsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const rowsPerPage = 5;

  // Sample dataset data
  const datasets = [
    { id: '123', title: 'Customer Feedback Analysis', owner: 'Data Insights Team', modified: '2024-01-15', status: 'Active' },
    { id: '456', title: 'Product Sales Data', owner: 'Sales Analytics Group', modified: '2023-12-20', status: 'Inactive' },
    { id: '789', title: 'Marketing Campaign Results', owner: 'Marketing Strategy Team', modified: '2024-02-05', status: 'Active' },
    { id: '101', title: 'Website Traffic Logs', owner: 'Web Analytics Department', modified: '2023-11-10', status: 'Active' },
    { id: '202', title: 'Social Media Engagement', owner: 'Social Media Team', modified: '2024-03-01', status: 'Active' },
    { id: '303', title: 'Customer Support Tickets', owner: 'Customer Support Department', modified: '2023-10-25', status: 'Inactive' },
    { id: '404', title: 'Financial Transactions', owner: 'Finance Department', modified: '2024-04-10', status: 'Active' },
    { id: '505', title: 'Employee Performance Reviews', owner: 'Human Resources Department', modified: '2023-09-15', status: 'Active' },
    { id: '606', title: 'Inventory Management Data', owner: 'Operations Team', modified: '2024-05-01', status: 'Inactive' },
    { id: '707', title: 'Research Study Results', owner: 'Research and Development Team', modified: '2023-08-05', status: 'Active' },
  ];

  // Filter datasets based on search term
  const filteredDatasets = datasets.filter(dataset =>
    dataset.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dataset.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dataset.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate pagination
  const pageCount = Math.ceil(filteredDatasets.length / rowsPerPage);
  const displayedDatasets = filteredDatasets.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Typography variant="h4" component="h1" gutterBottom>
        Datasets
      </Typography>
      
      {/* Search section */}
      <Typography variant="h6" component="h2" gutterBottom sx={{ mt: 3 }}>
        Search datasets
      </Typography>
      
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Search datasets..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setPage(1); // Reset to first page on new search
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 3 }}
      />
      
      {/* Filters */}
      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" gutterBottom>
              Filter
            </Typography>
            <FormControlLabel
              control={<Checkbox defaultChecked />}
              label="Dataset Owner"
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" gutterBottom>
              Status
            </Typography>
            <FormControlLabel
              control={<Checkbox defaultChecked />}
              label="✓"
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" gutterBottom>
              Update Frequency
            </Typography>
            <FormControlLabel
              control={<Checkbox defaultChecked />}
              label="✓"
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" gutterBottom>
              Creation Date Range
            </Typography>
            <FormControlLabel
              control={<Checkbox defaultChecked />}
              label="✓"
            />
          </Grid>
        </Grid>
      </Paper>
      
      {/* Dataset Table */}
      <TableContainer component={Paper} elevation={1}>
        <Table sx={{ minWidth: 650 }} aria-label="datasets table">
          <TableHead>
            <TableRow>
              <TableCell><strong>Dataset ID</strong></TableCell>
              <TableCell><strong>Title</strong></TableCell>
              <TableCell><strong>Owner</strong></TableCell>
              <TableCell><strong>Last Modified Date</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedDatasets.map((dataset) => (
              <TableRow key={dataset.id}>
                <TableCell>Dataset {dataset.id}</TableCell>
                <TableCell>{dataset.title}</TableCell>
                <TableCell>{dataset.owner}</TableCell>
                <TableCell>{dataset.modified}</TableCell>
                <TableCell>
                  <Chip 
                    label={dataset.status} 
                    color={dataset.status === 'Active' ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Pagination */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Pagination 
          count={pageCount} 
          page={page} 
          onChange={handlePageChange}
          showFirstButton 
          showLastButton
          siblingCount={1}
          boundaryCount={1}
          renderItem={(item) => {
            if (item.type === 'page') {
              // Customize the pagination item to match the design
              if (item.page === page) {
                return (
                  <Pagination 
                    {...item} 
                    sx={{ 
                      fontWeight: 'bold',
                      backgroundColor: 'primary.main',
                      color: 'white'
                    }}
                  />
                );
              }
            }
            return <Pagination {...item} />;
          }}
        />
      </Box>
    </Box>
  );
};

export default DatasetsPage;