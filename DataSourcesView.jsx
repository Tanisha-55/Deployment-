import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  TableChart,
  ViewColumn,
  Download
} from '@mui/icons-material';

const DataSourcesView = ({ dataset }) => {
  // Flatten the data for the unified grid
  const flattenedData = [];
  dataset.dataSources.forEach(source => {
    source.tables.forEach(table => {
      table.columns.forEach(column => {
        flattenedData.push({
          platform: source.platform,
          database: source.database,
          table: table.name,
          column: column
        });
      });
    });
  });

  return (
    <Box>
      <Typography variant="h6" gutterBottom fontWeight="600" color="primary" sx={{ mb: 2 }}>
        Data Sources
      </Typography>
      
      <Card sx={{ borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="body1">
              Total: {flattenedData.length} columns across {dataset.dataSources.length} data sources
            </Typography>
            <Tooltip title="Export to CSV">
              <IconButton size="small">
                <Download />
              </IconButton>
            </Tooltip>
          </Box>
          
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f7f9' }}>
                  <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Platform</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Database</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Table</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '34%' }}>Column</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {flattenedData.map((row, index) => (
                  <TableRow key={index} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <TableChart sx={{ mr: 1, color: 'primary.main', fontSize: '1rem' }} />
                        {row.platform}
                      </Box>
                    </TableCell>
                    <TableCell>{row.database}</TableCell>
                    <TableCell>{row.table}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <ViewColumn sx={{ mr: 1, color: 'text.secondary', fontSize: '1rem' }} />
                        {row.column}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DataSourcesView;