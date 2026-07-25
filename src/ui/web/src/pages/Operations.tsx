import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { operationsAPI, Task, userAPI, User } from '../services/api';
import { useDialogForm } from '../components/common';

const Operations: React.FC = () => {
  const {
    open,
    setOpen,
    selectedItem: selectedTask,
    setSelectedItem: setSelectedTask,
    formData,
    setFormData,
    handleOpen,
    handleClose,
  } = useDialogForm<Task>();
  const queryClient = useQueryClient();

  const { data: tasks, isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: operationsAPI.getTasks
  });

  const { data: workforceStatus } = useQuery({
    queryKey: ['workforce'],
    queryFn: operationsAPI.getWorkforceStatus
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: userAPI.getUsers
  });

  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['workforce'] });
  };

  const onSaved = () => {
    setSaveError(null);
    refresh();
    handleClose();
  };

  const onFailed = (e: any) =>
    setSaveError(e?.response?.data?.message || e?.message || 'Could not save the task');

  const createMutation = useMutation({
    mutationFn: operationsAPI.createTask,
    onSuccess: onSaved,
    onError: onFailed,
  });

  const updateMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: any }) =>
      operationsAPI.updateTask(taskId, data),
    onSuccess: onSaved,
    onError: onFailed,
  });

  const saving = createMutation.isPending || updateMutation.isPending;

  // One dialog does both jobs: creating a task and editing an existing one.
  // Previously the "Create" branch existed but nothing could reach it — there
  // was no button to open the dialog without a row, and submit only assigned.
  const handleSubmit = () => {
    setSaveError(null);
    if (selectedTask) {
      updateMutation.mutate({
        taskId: selectedTask.id,
        data: {
          status: formData.status || selectedTask.status,
          assignee: formData.assignee ?? selectedTask.assignee,
        },
      });
      return;
    }
    if (!formData.kind) {
      setSaveError('Task type is required');
      return;
    }
    createMutation.mutate({
      kind: formData.kind,
      status: formData.status || 'pending',
      assignee: formData.assignee || undefined,
    });
  };

  const openCreate = () => {
    setSaveError(null);
    setSelectedTask(null);
    setFormData({ kind: '', status: 'pending', assignee: '' } as any);
    setOpen(true);
  };

  const openEdit = (task: Task) => {
    setSaveError(null);
    handleOpen(task);
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'kind', headerName: 'Task Type', width: 150 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => {
        const status = params.value;
        const color = status === 'completed' ? 'success' : 
                     status === 'in_progress' ? 'info' : 'warning';
        return <Chip label={status} color={color} size="small" />;
      },
    },
    { field: 'assignee', headerName: 'Assignee', width: 150 },
    {
      field: 'created_at',
      headerName: 'Created',
      width: 150,
      renderCell: (params) => new Date(params.value).toLocaleDateString(),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 110,
      sortable: false,
      renderCell: (params) => (
        <Button size="small" onClick={() => openEdit(params.row)}>
          Edit
        </Button>
      ),
    },
  ];

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Operations Management
        </Typography>
        <Alert severity="error">
          Failed to load operations data. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="h4">Operations</Typography>
          <Typography variant="body2" color="text.secondary">
            Tasks, assignments and workforce status
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>
          New task
        </Button>
      </Box>

      {/* Workforce status.
          These were six cards in six different pastel fills — primary, success,
          info, warning, secondary and grey — which read as six unrelated
          severities rather than one set of numbers. Now one neutral card
          treatment, with colour reserved for the one figure that carries a
          judgement (utilisation). */}
      {workforceStatus && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}
          >
            Workforce
          </Typography>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {(() => {
              const util =
                workforceStatus.total_workers > 0
                  ? Math.round(
                      (workforceStatus.active_workers / workforceStatus.total_workers) * 100
                    )
                  : 0;
              const cards = [
                { label: 'Total workers', value: workforceStatus.total_workers },
                { label: 'Active', value: workforceStatus.active_workers },
                { label: 'Available', value: workforceStatus.available_workers },
                { label: 'In progress', value: workforceStatus.tasks_in_progress },
                { label: 'Pending', value: workforceStatus.tasks_pending },
                {
                  label: 'Utilisation',
                  value: `${util}%`,
                  accent:
                    util >= 90 ? 'warning.main' : util >= 40 ? 'success.main' : 'text.primary',
                },
              ];
              return cards.map((c) => (
                <Grid item xs={6} sm={4} md={2} key={c.label}>
                  <Box
                    sx={{
                      p: 1.75,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      height: '100%',
                    }}
                  >
                    <Typography
                      variant="h4"
                      sx={{
                        fontWeight: 600,
                        lineHeight: 1.1,
                        fontVariantNumeric: 'tabular-nums',
                        color: (c as any).accent || 'text.primary',
                      }}
                    >
                      {c.value}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {c.label}
                    </Typography>
                  </Box>
                </Grid>
              ));
            })()}
          </Grid>
        </Paper>
      )}

      {/* Tasks Management */}
      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={tasks || []}
          columns={columns}
          loading={isLoading}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10 },
            },
          }}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
        />
      </Paper>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedTask ? `Edit task #${selectedTask.id}` : 'New task'}
        </DialogTitle>
        <DialogContent>
          {saveError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {saveError}
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Task Type"
                value={formData.kind || ''}
                onChange={(e) => setFormData({ ...formData, kind: e.target.value })}
                disabled={!!selectedTask}
                required
                helperText={
                  selectedTask
                    ? 'Task type cannot be changed after creation'
                    : 'e.g. cycle_count, replenishment, pick, putaway'
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Assignee</InputLabel>
                <Select
                  value={formData.assignee || ''}
                  onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                  label="Assignee"
                >
                  {users && users.length > 0 ? (
                    users.map((user: User) => (
                      <MenuItem key={user.id} value={user.full_name || user.username}>
                        {user.full_name || user.username} ({user.role})
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value="">No users available</MenuItem>
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status || ''}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  label="Status"
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={saving}
          >
            {saving ? 'Saving…' : selectedTask ? 'Save changes' : 'Create task'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Operations;
