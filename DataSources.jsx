import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  GridLegacy as Grid,
  FormHelperText,
  Tooltip,
  IconButton,
  Button,
  TextField
} from '@mui/material';
import { HelpOutline, Add, Delete } from '@mui/icons-material';

const DataSources = ({ data, onChange, onValidityChange }) => {
  const [dataSources, setDataSources] = useState(data || [
    {
      id: 'DSRC-001',
      platform: '',
      schema: '',
      database: '',
      table: '',
      column: '',
      file: '',
      dataElements: '',
      collibraElements: ''
    }
  ]);

  // Update local state when parent data changes
  useEffect(() => {
    setDataSources(data || [
      {
        id: 'DSRC-001',
        platform: '',
        schema: '',
        database: '',
        table: '',
        column: '',
        file: '',
        dataElements: '',
        collibraElements: ''
      }
    ]);
  }, [data]);

  // Notify parent of changes
  useEffect(() => {
    if (onChange) {
      onChange(dataSources);
    }
  }, [dataSources, onChange]);

  useEffect(() => {
    // Data Sources are optional, so always valid
    if (onValidityChange) {
      onValidityChange(true);
    }
  }, [onValidityChange]);

  const handleAddDataSource = () => {
    const newDataSources = [
      ...dataSources,
      {
        id: `DSRC-${Math.floor(1000 + Math.random() * 9000)}`,
        platform: '',
        schema: '',
        database: '',
        table: '',
        column: '',
        file: '',
        dataElements: '',
        collibraElements: ''
      }
    ];
    setDataSources(newDataSources);
  };

  const handleRemoveDataSource = (index) => {
    if (dataSources.length > 1) {
      const updated = [...dataSources];
      updated.splice(index, 1);
      setDataSources(updated);
    }
  };

  const handleDataSourceChange = (index, field) => (event) => {
    const updated = [...dataSources];
    updated[index][field] = event.target.value;
    setDataSources(updated);
  };

  // Tooltip texts based on requirements
  const tooltips = {
    platform: 'Select the platform for this data source',
    schema: 'Select the schema for this data source',
    database: 'Select the database for this data source',
    table: 'Select the table for this data source',
    column: 'Select the column for this data source',
    file: 'Enter the file name for this data source',
    dataElements: 'Data elements associated with this data source',
    collibraElements: 'Collibra elements associated with this data source'
  };

  const platformOptions = ['Platform A', 'Platform B', 'Platform C'];
  const schemaOptions = ['Schema 1', 'Schema 2', 'Schema 3'];
  const databaseOptions = ['DB 极', 'DB 2', 'DB 3'];
  const tableOptions = ['Table 1', 'Table 2', 'Table 3'];
  const columnOptions = ['Column 1', 'Column 2', 'Column 3'];

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Data Sources
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        Configure data sources for this dataset (optional)
      </Typography>

      {dataSources.map((dataSource, index) => (
        <Box key={dataSource.id} sx={{ mt: 3, p: 2, border: '1px solid #eee', borderRadius: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Data Source {index + 1}
            </Typography>
            <Button 
              onClick={() => handleRemoveDataSource(index)}
              disabled={dataSources.length === 1}
              color="error"
              startIcon={<Delete />}
            >
              Remove
            </Button>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Platform</InputLabel>
                <Select
                  value={dataSource.platform}
                  label="Platform"
                  onChange={handleDataSourceChange(index, 'platform')}
                >
                  {platformOptions.map(option => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  <Tooltip title={tooltips.platform} arrow>
                    <IconButton size="small">
                      <HelpOutline />
                    </IconButton>
                  </Tooltip>
                  {tooltips.platform}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Schema</InputLabel>
                <Select
                  value={dataSource.schema}
                  label="Schema"
                  onChange={handleDataSourceChange(index, 'schema')}
                >
                  {schemaOptions.map(option => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  <Tooltip title={tooltips.schema} arrow>
                    <IconButton size="small">
                      <HelpOutline />
                    </IconButton>
                  </Tooltip>
                  {tooltips.schema}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Database</InputLabel>
                <Select
                  value={dataSource.database}
                  label="Database"
                  onChange={handleDataSourceChange(index, 'database')}
                >
                  {databaseOptions.map(option => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  <Tooltip title={tooltips.database} arrow>
                    <IconButton size="small">
                      <HelpOutline />
                    </IconButton>
                  </Tooltip>
                  {tooltips.database}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Table</InputLabel>
                <Select
                  value={dataSource.table}
                  label="Table"
                  onChange={handleDataSourceChange(index, 'table')}
                >
                  {tableOptions.map(option => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  <Tooltip title={tooltips.table} arrow>
                    <IconButton size="small">
                      <HelpOutline />
                    </IconButton>
                  </Tooltip>
                  {tooltips.table}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Column</InputLabel>
                <Select
                  value={dataSource.column}
                  label="Column"
                  onChange={handleDataSourceChange(index, 'column')}
                >
                  {columnOptions.map(option => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  <Tooltip title={tooltips.column} arrow>
                    <IconButton size="small">
                      <HelpOutline />
                    </IconButton>
                  </Tooltip>
                  {tooltips.column}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>File</InputLabel>
                <Select
                  value={dataSource.file}
                  label="File"
                  onChange={handleDataSourceChange(index, 'file')}
                >
                  <MenuItem value="File 1">File 1</MenuItem>
                  <MenuItem value="File 2">File 2</MenuItem>
                  <MenuItem value="File 3">File 3</MenuItem>
                </Select>
                <FormHelperText>
                  <Tooltip title={tooltips.file} arrow>
                    <IconButton size="small">
                      <HelpOutline />
                    </IconButton>
                  </Tooltip>
                  {tooltips.file}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Data Elements"
                value={dataSource.dataElements}
                onChange={handleDataSourceChange(index, 'dataElements')}
                helperText={tooltips.dataElements}
                InputProps={{
                  endAdornment: (
                    <Tooltip title={tooltips.dataElements} arrow>
                      <IconButton size="small">
                        <HelpOutline />
                      </IconButton>
                    </Tooltip>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Collibra Elements"
                value={dataSource.collibraElements}
                onChange={handleDataSourceChange(index, 'collibraElements')}
                helperText={tooltips.collibraElements}
                InputProps={{
                  endAdornment: (
                    <Tooltip title={tooltips.collibraElements} arrow>
                      <IconButton size="small">
                        <HelpOutline />
                      </IconButton>
                    </Tooltip>
                  ),
                }}
              />
            </Grid>
          </Grid>
        </Box>
      ))}

      <Button
        variant="outlined"
        startIcon={<Add />}
        onClick={handleAddDataSource}
        sx={{ mt: 2 }}
      >
        Add Data Source
      </Button>
    </Box>
  );
};

export default DataSources;