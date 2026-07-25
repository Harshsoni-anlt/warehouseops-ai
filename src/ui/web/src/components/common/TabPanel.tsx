// SPDX-FileCopyrightText: Copyright (c) 2025  CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React from 'react';
import { Box } from '@mui/material';

export interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
  idPrefix?: string;
  padding?: number | string;
  fullWidth?: boolean;
}

/**
 * Shared TabPanel component to eliminate duplication across page components.
 * 
 * @param children - Content to display in the tab panel
 * @param index - The index of this tab panel
 * @param value - The currently selected tab index
 * @param idPrefix - Optional prefix for the tab panel ID (defaults to 'tabpanel')
 * @param padding - Padding for the content box (defaults to 3)
 * @param fullWidth - Whether the panel should take full width (defaults to false)
 */
export const TabPanel: React.FC<TabPanelProps> = ({
  children,
  value,
  index,
  idPrefix = 'tabpanel',
  padding = 3,
  fullWidth = false,
  ...other
}) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`${idPrefix}-tabpanel-${index}`}
      aria-labelledby={`${idPrefix}-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: padding, ...(fullWidth && { width: '100%' }) }}>
          {children}
        </Box>
      )}
    </div>
  );
};

export default TabPanel;

