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

import { useState, useCallback } from 'react';

/**
 * Shared hook for managing dialog form state to eliminate duplication.
 * 
 * This hook provides a consistent pattern for:
 * - Opening/closing dialogs
 * - Managing selected items
 * - Managing form data
 * 
 * @template T - The type of the item being edited/created
 * @returns Object containing dialog state and handlers
 */
export function useDialogForm<T extends Record<string, any>>() {
  const [open, setOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const [formData, setFormData] = useState<Partial<T>>({});

  const handleOpen = useCallback((item?: T) => {
    if (item) {
      setSelectedItem(item);
      setFormData(item);
    } else {
      setSelectedItem(null);
      setFormData({});
    }
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setSelectedItem(null);
    setFormData({});
  }, []);

  const resetForm = useCallback(() => {
    setFormData({});
    setSelectedItem(null);
  }, []);

  return {
    open,
    setOpen,
    selectedItem,
    setSelectedItem,
    formData,
    setFormData,
    handleOpen,
    handleClose,
    resetForm,
  };
}

