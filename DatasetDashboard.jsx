import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
  IconButton,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  GridLegacy as Grid,
  InputAdornment,
  Avatar,
  AvatarGroup,
  LinearProgress,
  alpha,
  useTheme
} from '@mui/material';
import {
  Add,
  FilterList,
  Search,
  Refresh,
  ViewModule,
  ViewList,
  MoreVert,
  FileDownload,
  Visibility,
  Edit
} from '@mui/icons-material';
import { Link } from 'react-router-dom';

const DatasetDashboard = () => {
  const [filterOwner, setFilterOwner] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrequency, setFilterFrequency] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [datasets, setDatasets] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
  const theme = useTheme();

  // Load datasets from localStorage on component mount
  useEffect(() => {
    const storedDatasets = JSON.parse(localStorage.getItem('datasets') || '[]');
    setDatasets(storedDatasets);
  }, []);

  // Add some default datasets if none exist
  useEffect(() => {
    if (datasets.length === 0) {
      const defaultDatasets = [
        { 
          id: 'DS-12345', 
          title: 'Climate Data for 2023', 
          owner: 'Dr. Amelia Bennett', 
          modified: '2024-01-15', 
          status: 'Active',
          progress: 85,
          size: '2.4 GB',
          access: ['A', 'B', 'C']
        },
        { 
          id: 'DS-67890', 
          title: 'Oceanographic Data', 
          owner: 'Prof. Owen Chen', 
          modified: '2023-12-20', 
          status: 'Inactive',
          progress: 42,
          size: '1.2 GB',
          access: ['A', 'D']
        },
        { 
          id: 'DS-11223', 
          title: 'Atmospheric Data', 
          owner: 'Dr. Isabella Patel', 
          modified: '2024-02-01', 
          status: 'Active',
          progress: 100,
          size: '3.1 GB',
          access: ['A', 'B', 'E', 'F']
        },
        { 
          id: 'DS-44556', 
          title: 'Geological Data', 
          owner: 'Dr. Oliver Hayes', 
          modified: '2023-11-10', 
          status: 'Active',
          progress: 67,
          size: '4.5 GB',
          access: ['A', 'G']
        },
        { 
          id: 'DS-77889', 
          title: 'Ecological Data', 
          owner: 'Prof. Sofia Rossi', 
          modified: '2024-01-25', 
          status: 'Inactive',
          progress: 29,
          size: '0.8 GB',
          access: ['A', 'B', 'H']
        },
      ];
      setDatasets(defaultDatasets);
      localStorage.setItem('datasets', JSON.stringify(defaultDatasets));
    }
  }, [datasets.length]);

  const statusColors = {
    Active: 'success',
    Inactive: 'default',
    Pending: 'warning',
    Deprecated: 'error',
    Terminated: 'error'
  };

  // Filter datasets based on filter criteria
  const filteredDatasets = datasets.filter(dataset => {
    const matchesSearch = searchQuery === '' || 
      dataset.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dataset.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    return (
      matchesSearch &&
      (filterOwner === '' || dataset.owner.includes(filterOwner)) &&
      (filterStatus === '' || dataset.status === filterStatus) &&
      (filterFrequency === '' || true) && // Add frequency filter if needed
      (startDate === '' || dataset.modified >= startDate) &&
      (endDate === '' || dataset.modified <= endDate)
    );
  });

  const clearFilters = () => {
    setFilterOwner('');
    setFilterStatus('');
    setFilterFrequency('');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
  };

  return (
    <Box sx={{ p: 3, backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      {/* Header Section */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight="600" color="primary">
            Datasets
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage and organize your datasets
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<Add />} 
          component={Link}
          to="/create-dataset"
          sx={{ 
            borderRadius: 2,
            px: 3,
            py: 1,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}
        >
          Create Dataset
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ 
            borderRadius: 3, 
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            background: 'linear-gradient(135deg, #f6f9fc, #fff)'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography color="text.secondary" variant="body2" gutterBottom>
                Total Datasets
              </Typography>
              <Typography variant="h4" fontWeight="600">
                {datasets.length}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" color="success.main" sx={{ display: 'flex', alignItems: 'center' }}>
                  +12% from last month
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ 
            borderRadius: 3, 
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            background: 'linear-gradient(135deg, #f6f9fc, #fff)'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography color="text.secondary" variant="body2" gutterBottom>
                Active Datasets
              </Typography>
              <Typography variant="h4" fontWeight="600">
                {datasets.filter(d => d.status === 'Active').length}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" color="success.main">
                  78% utilization
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ 
            borderRadius: 3, 
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            background: 'linear-gradient(135deg, #f6f9fc, #fff)'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography color="text.secondary" variant="body2" gutterBottom>
                Recent Activity
              </Typography>
              <Typography variant="h4" fontWeight="600">
                24
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  updates today
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filter Section */}
      <Card sx={{ 
        mb: 4, 
        borderRadius: 3, 
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        background: 'linear-gradient(135deg, #f6f9fc, #fff)'
      }}>
        <CardContent sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight="500">
              Filter Datasets
            </Typography>
            <Box>
              <IconButton size="small" onClick={clearFilters}>
                <Refresh />
              </IconButton>
            </Box>
          </Box>
          
          <TextField
            fullWidth
            placeholder="Search datasets by title or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" />
                </InputAdornment>
              ),
            }}
          />
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={6}>
              <FormControl fullWidth>
                <InputLabel>Dataset Owner</InputLabel>
                <Select
                  value={filterOwner}
                  label="Dataset Owner"
                  onChange={(e) => setFilterOwner(e.target.value)}
                >
                  <MenuItem value="">All Owners</MenuItem>
                  {Array.from(new Set(datasets.map(d => d.owner))).map(owner => (
                    <MenuItem key={owner} value={owner}>{owner}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={6}>
              <FormControl fullWidth>
                <InputLabel>Dataset Status</InputLabel>
                <Select
                  value={filterStatus}
                  label="Dataset Status"
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          
        </CardContent>
      </Card>

      {/* Results Count */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="body2" color="text.secondary">
          Showing {filteredDatasets.length} of {datasets.length} datasets
        </Typography>
      </Box>

      {/* Datasets Table */}
      {viewMode === 'table' ? (
        <TableContainer 
          component={Paper} 
          sx={{ 
            borderRadius: 3, 
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: '600', py: 2 }}>Dataset ID</TableCell>
                <TableCell sx={{ fontWeight: '600', py: 2 }}>Title</TableCell>
                <TableCell sx={{ fontWeight: '600', py: 2 }}>Owner</TableCell>
                <TableCell sx={{ fontWeight: '600', py: 2 }}>Last Modified</TableCell>
                <TableCell sx={{ fontWeight: '600', py: 2 }}>Status</TableCell>
                {/* <TableCell sx={{ fontWeight: '600', py: 2 }} align="right">Actions</TableCell> */}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDatasets.map((dataset) => (
                <TableRow 
                  key={dataset.id}
                  hover
                  sx={{ 
                    '&:last-child td, &:last-child th': { border: 0 },
                    transition: 'background-color 0.2s'
                  }}
                >
                  <TableCell sx={{ fontWeight: '500' }}>{dataset.id}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="500">
                      {dataset.title}
                    </Typography>
                  </TableCell>
                  <TableCell>{dataset.owner}</TableCell>
                  <TableCell>{dataset.modified}</TableCell>
                  <TableCell>
                    <Chip 
                      label={dataset.status} 
                      color={statusColors[dataset.status] || 'default'} 
                      size="small"
                      variant={dataset.status === 'Active' ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  {/* <TableCell align="right">
                    <IconButton size="small" color="primary">
                      <Visibility />
                    </IconButton>
                    <IconButton size="small" color="secondary">
                      <Edit />
                    </IconButton>
                    <IconButton size="small">
                      <FileDownload />
                    </IconButton>
                  </TableCell> */}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        // Grid View
        <Grid container spacing={2}>
          {filteredDatasets.map((dataset) => (
            <Grid item xs={12} sm={6} md={4} key={dataset.id}>
              <Card sx={{ 
                borderRadius: 3, 
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                }
              }}>
                <CardContent sx={{ p: 3, flexGrow: 1 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Chip 
                      label={dataset.status} 
                      color={statusColors[dataset.status] || 'default'} 
                      size="small"
                    />
                    <IconButton size="small">
                      <MoreVert />
                    </IconButton>
                  </Box>
                  
                  <Typography variant="h6" fontWeight="600" gutterBottom>
                    {dataset.title}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {dataset.id}
                  </Typography>
                  
                  <Typography variant="body2" sx={{ my: 1 }}>
                    <Box component="span" fontWeight="500">Owner:</Box> {dataset.owner}
                  </Typography>
                  
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <Box component="span" fontWeight="500">Modified:</Box> {dataset.modified}
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" gutterBottom>Storage: {dataset.size}</Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={dataset.progress} 
                      sx={{ borderRadius: 5, height: 6 }}
                      color={dataset.progress === 100 ? 'success' : 'primary'}
                    />
                  </Box>
                  
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <AvatarGroup max={3}>
                      {dataset.access.map((letter, index) => (
                        <Avatar key={index} sx={{ width: 28, height: 28, fontSize: '0.8rem' }}>
                          {letter}
                        </Avatar>
                      ))}
                    </AvatarGroup>
                    
                    <Box>
                      <IconButton size="small" color="primary">
                        <Visibility />
                      </IconButton>
                      <IconButton size="small" color="secondary">
                        <Edit />
                      </IconButton>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default DatasetDashboard;