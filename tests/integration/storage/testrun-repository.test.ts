/**
 * TestRun Repository Integration Tests
 * @module tests/integration/storage/testrun-repository.test
 * @version 1.0.0
 * 
 * Integration tests for TestRunRepository with real IndexedDB operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

import { db } from '@/core/storage';
import { ProjectRepository } from '@/core/storage/repositories/ProjectRepository';
import { TestRunRepository } from '@/core/storage/repositories/TestRunRepository';
import type { TestRunCreateInput, TestRunStatus } from '@/core/types';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('TestRunRepository Integration', () => {
  let projectRepository: ProjectRepository;
  let testRunRepository: TestRunRepository;
  let projectId: number;

  beforeEach(async () => {
    // Clear database
    await db.projects.clear();
    await db.testRuns.clear();

    // Create repositories
    projectRepository = new ProjectRepository(db);
    testRunRepository = new TestRunRepository(db);

    // Create a project for test runs
    projectId = await projectRepository.create({
      name: 'Test Project',
      description: 'Project for test run tests',
      target_url: 'https://example.com',
    });
  });

  afterEach(async () => {
    await db.projects.clear();
    await db.testRuns.clear();
  });

  // ==========================================================================
  // CREATE TESTS
  // ==========================================================================

  describe('create', () => {
    it('should create a new test run', async () => {
      const input: TestRunCreateInput = {
        project_id: projectId,
        total_steps: 5,
      };

      const id = await testRunRepository.create(input);

      expect(id).toBeTypeOf('number');
      expect(id).toBeGreaterThan(0);

      const testRun = await db.testRuns.get(id);
      expect(testRun).toBeDefined();
      expect(testRun?.project_id).toBe(projectId);
      expect(testRun?.status).toBe('pending');
      expect(testRun?.total_steps).toBe(5);
      expect(testRun?.passed_steps).toBe(0);
      expect(testRun?.failed_steps).toBe(0);
      expect(testRun?.test_results).toEqual([]);
      expect(testRun?.logs).toBe('');
      expect(testRun?.start_time).toBeDefined();
    });

    it('should set start_time automatically', async () => {
      const beforeCreate = new Date().toISOString();

      const id = await testRunRepository.create({
        project_id: projectId,
        total_steps: 3,
      });

      const afterCreate = new Date().toISOString();

      const testRun = await db.testRuns.get(id);
      expect(testRun?.start_time).toBeDefined();
      expect(testRun?.start_time! >= beforeCreate).toBe(true);
      expect(testRun?.start_time! <= afterCreate).toBe(true);
    });

    it('should create multiple test runs for same project', async () => {
      const id1 = await testRunRepository.create({ project_id: projectId, total_steps: 3 });
      const id2 = await testRunRepository.create({ project_id: projectId, total_steps: 5 });
      const id3 = await testRunRepository.create({ project_id: projectId, total_steps: 2 });

      const testRuns = await testRunRepository.getByProjectId(projectId);

      expect(testRuns).toHaveLength(3);
      expect(testRuns.map(r => r.id)).toContain(id1);
      expect(testRuns.map(r => r.id)).toContain(id2);
      expect(testRuns.map(r => r.id)).toContain(id3);
    });
  });

  // ==========================================================================
  // READ TESTS
  // ==========================================================================

  describe('getById', () => {
    it('should retrieve test run by ID', async () => {
      const id = await testRunRepository.create({
        project_id: projectId,
        total_steps: 10,
      });

      const testRun = await testRunRepository.getById(id);

      expect(testRun).toBeDefined();
      expect(testRun?.id).toBe(id);
      expect(testRun?.total_steps).toBe(10);
    });

    it('should return undefined for non-existent ID', async () => {
      const testRun = await testRunRepository.getById(99999);
      expect(testRun).toBeUndefined();
    });
  });

  describe('getByProjectId', () => {
    it('should return empty array for project with no test runs', async () => {
      const testRuns = await testRunRepository.getByProjectId(projectId);
      expect(testRuns).toEqual([]);
    });

    it('should return only test runs for specified project', async () => {
      // Create another project
      const otherProjectId = await projectRepository.create({ name: 'Other Project' });

      // Create test runs for both projects
      await testRunRepository.create({ project_id: projectId, total_steps: 3 });
      await testRunRepository.create({ project_id: projectId, total_steps: 5 });
      await testRunRepository.create({ project_id: otherProjectId, total_steps: 2 });

      const testRuns = await testRunRepository.getByProjectId(projectId);

      expect(testRuns).toHaveLength(2);
      expect(testRuns.every(r => r.project_id === projectId)).toBe(true);
    });

    it('should return test runs in creation order', async () => {
      const id1 = await testRunRepository.create({ project_id: projectId, total_steps: 1 });
      const id2 = await testRunRepository.create({ project_id: projectId, total_steps: 2 });
      const id3 = await testRunRepository.create({ project_id: projectId, total_steps: 3 });

      const testRuns = await testRunRepository.getByProjectId(projectId);

      expect(testRuns[0].id).toBe(id1);
      expect(testRuns[1].id).toBe(id2);
      expect(testRuns[2].id).toBe(id3);
    });
  });

  // ==========================================================================
  // UPDATE TESTS
  // ==========================================================================

  describe('update', () => {
    it('should update status', async () => {
      const id = await testRunRepository.create({
        project_id: projectId,
        total_steps: 5,
      });

      await testRunRepository.update(id, { status: 'running' });

      const testRun = await testRunRepository.getById(id);
      expect(testRun?.status).toBe('running');
    });

    it('should update passed and failed steps', async () => {
      const id = await testRunRepository.create({
        project_id: projectId,
        total_steps: 10,
      });

      await testRunRepository.update(id, {
        passed_steps: 7,
        failed_steps: 2,
      });

      const testRun = await testRunRepository.getById(id);
      expect(testRun?.passed_steps).toBe(7);
      expect(testRun?.failed_steps).toBe(2);
    });

    it('should update test results', async () => {
      const id = await testRunRepository.create({
        project_id: projectId,
        total_steps: 3,
      });

      const testResults = [
        { step_id: '1', status: 'passed' as const, duration: 100 },
        { step_id: '2', status: 'passed' as const, duration: 150 },
        { step_id: '3', status: 'failed' as const, duration: 2000, error_message: 'Timeout' },
      ];

      await testRunRepository.update(id, { test_results: testResults });

      const testRun = await testRunRepository.getById(id);
      expect(testRun?.test_results).toHaveLength(3);
      expect(testRun?.test_results?.[2].error_message).toBe('Timeout');
    });

    it('should update logs', async () => {
      const id = await testRunRepository.create({
        project_id: projectId,
        total_steps: 2,
      });

      await testRunRepository.update(id, {
        logs: 'Step 1: Passed\nStep 2: Failed - Element not found',
      });

      const testRun = await testRunRepository.getById(id);
      expect(testRun?.logs).toContain('Element not found');
    });

    it('should set end_time on completion', async () => {
      const id = await testRunRepository.create({
        project_id: projectId,
        total_steps: 3,
      });

      const endTime = new Date().toISOString();

      await testRunRepository.update(id, {
        status: 'completed',
        end_time: endTime,
        passed_steps: 3,
      });

      const testRun = await testRunRepository.getById(id);
      expect(testRun?.status).toBe('completed');
      expect(testRun?.end_time).toBe(endTime);
    });
  });

  // ==========================================================================
  // DELETE TESTS
  // ==========================================================================

  describe('delete', () => {
    it('should delete test run', async () => {
      const id = await testRunRepository.create({
        project_id: projectId,
        total_steps: 5,
      });

      await testRunRepository.delete(id);

      const testRun = await testRunRepository.getById(id);
      expect(testRun).toBeUndefined();
    });

    it('should not affect other test runs', async () => {
      const id1 = await testRunRepository.create({ project_id: projectId, total_steps: 1 });
      const id2 = await testRunRepository.create({ project_id: projectId, total_steps: 2 });
      const id3 = await testRunRepository.create({ project_id: projectId, total_steps: 3 });

      await testRunRepository.delete(id2);

      const testRuns = await testRunRepository.getByProjectId(projectId);
      expect(testRuns).toHaveLength(2);
      expect(testRuns.map(r => r.id)).toContain(id1);
      expect(testRuns.map(r => r.id)).toContain(id3);
      expect(testRuns.map(r => r.id)).not.toContain(id2);
    });
  });

  // ==========================================================================
  // STATUS WORKFLOW TESTS
  // ==========================================================================

  describe('status workflow', () => {
    it('should track full test run lifecycle', async () => {
      // Create
      const id = await testRunRepository.create({
        project_id: projectId,
        total_steps: 3,
      });

      let testRun = await testRunRepository.getById(id);
      expect(testRun?.status).toBe('pending');

      // Start running
      await testRunRepository.update(id, { status: 'running' });
      testRun = await testRunRepository.getById(id);
      expect(testRun?.status).toBe('running');

      // Step 1 passes
      await testRunRepository.update(id, {
        passed_steps: 1,
        test_results: [{ step_id: '1', status: 'passed', duration: 100 }],
      });

      // Step 2 passes
      await testRunRepository.update(id, {
        passed_steps: 2,
        test_results: [
          { step_id: '1', status: 'passed', duration: 100 },
          { step_id: '2', status: 'passed', duration: 150 },
        ],
      });

      // Step 3 fails
      await testRunRepository.update(id, {
        passed_steps: 2,
        failed_steps: 1,
        test_results: [
          { step_id: '1', status: 'passed', duration: 100 },
          { step_id: '2', status: 'passed', duration: 150 },
          { step_id: '3', status: 'failed', duration: 2000, error_message: 'Element not found' },
        ],
        status: 'failed',
        end_time: new Date().toISOString(),
      });

      testRun = await testRunRepository.getById(id);
      expect(testRun?.status).toBe('failed');
      expect(testRun?.passed_steps).toBe(2);
      expect(testRun?.failed_steps).toBe(1);
      expect(testRun?.end_time).toBeDefined();
    });
  });
});
