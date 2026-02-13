'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, Plus, Trash2, Save, Loader2, Search, Edit2, X,
  Link, Unlink, Filter, ChevronDown, ChevronRight, AlertTriangle,
  CheckCircle2, Target, BookOpen, GripVertical
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface MicroSkill {
  id: string;
  code: string;
  name: string;
  description: string;
  unitId: string;
  unitName?: string;
  examWeight: number;
  difficulty: number;
  formatTags: string[];
  isActive: boolean;
  prerequisiteCount: number;
  itemCount: number;
}

interface Item {
  id: string;
  itemType: string;
  format: string;
  prompt: string;
  difficulty: number;
  unitId: string;
  unitName?: string;
  isActive: boolean;
  skillMappings: {
    skillId: string;
    skillName: string;
    strength: number;
  }[];
}

interface SkillPrerequisite {
  skillId: string;
  prerequisiteId: string;
  prerequisiteName: string;
}

interface CurriculumUnit {
  id: string;
  name: string;
  code: string;
}

// ============================================================
// COMPONENT
// ============================================================

export default function AdminSkillsPage() {
  const { user, getIdToken } = useAuth();
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skills, setSkills] = useState<MicroSkill[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<CurriculumUnit[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'skills' | 'items' | 'mappings'>('skills');

  // Edit states
  const [editingSkill, setEditingSkill] = useState<MicroSkill | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [showNewSkillForm, setShowNewSkillForm] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [mappingTargetItem, setMappingTargetItem] = useState<Item | null>(null);

  // New skill form
  const [newSkill, setNewSkill] = useState({
    code: '',
    name: '',
    description: '',
    unitId: '',
    examWeight: 0.05,
    difficulty: 3,
    formatTags: [] as string[],
  });

  // ============================================================
  // DATA LOADING
  // ============================================================

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getIdToken();
      
      // Load skills
      const skillsRes = await fetch('/api/admin/skills', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!skillsRes.ok) throw new Error('Failed to load skills');
      const skillsData = await skillsRes.json();
      setSkills(skillsData.skills ?? []);
      
      // Load items
      const itemsRes = await fetch('/api/admin/items', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!itemsRes.ok) throw new Error('Failed to load items');
      const itemsData = await itemsRes.json();
      setItems(itemsData.items ?? []);
      
      // Load units
      const unitsRes = await fetch('/api/admin/curriculum', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (unitsRes.ok) {
        const unitsData = await unitsRes.json();
        setUnits(unitsData.units ?? []);
      }
      
    } catch (e) {
      console.error('Failed to load admin data:', e);
      setError('Failed to load data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ============================================================
  // SKILL CRUD
  // ============================================================

  const createSkill = async () => {
    try {
      setSaving(true);
      const token = await getIdToken();
      
      const res = await fetch('/api/admin/skills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newSkill),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to create skill');
      }
      
      setSuccess('Skill created successfully');
      setShowNewSkillForm(false);
      setNewSkill({
        code: '',
        name: '',
        description: '',
        unitId: '',
        examWeight: 0.05,
        difficulty: 3,
        formatTags: [],
      });
      await loadData();
      
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const updateSkill = async (skill: MicroSkill) => {
    try {
      setSaving(true);
      const token = await getIdToken();
      
      const res = await fetch(`/api/admin/skills/${skill.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(skill),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to update skill');
      }
      
      setSuccess('Skill updated successfully');
      setEditingSkill(null);
      await loadData();
      
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteSkill = async (skillId: string) => {
    if (!confirm('Are you sure you want to delete this skill? This will remove all item mappings.')) {
      return;
    }
    
    try {
      setSaving(true);
      const token = await getIdToken();
      
      const res = await fetch(`/api/admin/skills/${skillId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to delete skill');
      }
      
      setSuccess('Skill deleted');
      await loadData();
      
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // ITEM-SKILL MAPPING
  // ============================================================

  const addMapping = async (itemId: string, skillId: string, strength: number = 1.0) => {
    try {
      setSaving(true);
      const token = await getIdToken();
      
      const res = await fetch('/api/admin/item-skill-map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ itemId, skillId, strength }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to add mapping');
      }
      
      setSuccess('Mapping added');
      await loadData();
      
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const removeMapping = async (itemId: string, skillId: string) => {
    try {
      setSaving(true);
      const token = await getIdToken();
      
      const res = await fetch('/api/admin/item-skill-map', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ itemId, skillId }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to remove mapping');
      }
      
      setSuccess('Mapping removed');
      await loadData();
      
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // FILTERING
  // ============================================================

  const filteredSkills = skills.filter(skill => {
    if (selectedUnit !== 'all' && skill.unitId !== selectedUnit) return false;
    if (searchQuery && !skill.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !skill.code.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredItems = items.filter(item => {
    if (selectedUnit !== 'all' && item.unitId !== selectedUnit) return false;
    if (searchQuery && !item.prompt.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const unmappedItems = filteredItems.filter(item => item.skillMappings.length === 0);

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/admin')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Skills &amp; Item Mappings</h1>
                <p className="text-sm text-gray-500">
                  Manage micro-skills and their mappings to practice items
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewSkillForm(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Skill
              </Button>
            </div>
          </div>
          
          {/* View Tabs */}
          <div className="flex gap-2 mt-4">
            <Button
              variant={activeView === 'skills' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('skills')}
            >
              <Target className="w-4 h-4 mr-2" />
              Skills ({skills.length})
            </Button>
            <Button
              variant={activeView === 'items' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('items')}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Items ({items.length})
            </Button>
            <Button
              variant={activeView === 'mappings' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('mappings')}
            >
              <Link className="w-4 h-4 mr-2" />
              Unmapped ({unmappedItems.length})
            </Button>
          </div>
          
          {/* Filters */}
          <div className="flex gap-4 mt-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search skills or items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="all">All Units</option>
              {units.map(unit => (
                <option key={unit.id} value={unit.id}>{unit.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Alerts */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setError('')}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
      
      {success && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-green-700 dark:text-green-300">{success}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSuccess('')}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Skills View */}
        {activeView === 'skills' && (
          <div className="grid gap-4">
            {filteredSkills.map(skill => (
              <Card key={skill.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                          {skill.code}
                        </span>
                        <h3 className="font-semibold">{skill.name}</h3>
                        {!skill.isActive && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{skill.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span>Unit: {skill.unitName ?? skill.unitId}</span>
                        <span>Weight: {(skill.examWeight * 100).toFixed(0)}%</span>
                        <span>Difficulty: {skill.difficulty}/5</span>
                        <span className={skill.itemCount === 0 ? 'text-red-500 font-semibold' : ''}>
                          Items: {skill.itemCount}
                        </span>
                        <span>Prerequisites: {skill.prerequisiteCount}</span>
                      </div>
                      {skill.formatTags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {skill.formatTags.map(tag => (
                            <span key={tag} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingSkill(skill)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSkill(skill.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {filteredSkills.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No skills found. Create one to get started.
              </div>
            )}
          </div>
        )}
        
        {/* Items View */}
        {activeView === 'items' && (
          <div className="grid gap-4">
            {filteredItems.map(item => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded uppercase">
                          {item.itemType}
                        </span>
                        <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded">
                          {item.format}
                        </span>
                        <span className="text-xs text-gray-500">
                          Difficulty: {item.difficulty}/5
                        </span>
                      </div>
                      <p className="text-sm mt-2 line-clamp-2">{item.prompt}</p>
                      
                      {/* Skill mappings */}
                      <div className="mt-3">
                        <div className="text-xs text-gray-500 mb-1">Mapped Skills:</div>
                        {item.skillMappings.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.skillMappings.map(mapping => (
                              <div 
                                key={mapping.skillId}
                                className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-0.5 rounded text-xs"
                              >
                                <Target className="w-3 h-3" />
                                {mapping.skillName}
                                <span className="text-green-600">({mapping.strength.toFixed(1)})</span>
                                <button
                                  onClick={() => removeMapping(item.id, mapping.skillId)}
                                  className="ml-1 hover:text-red-500"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-red-500 font-semibold">⚠️ No skills mapped</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMappingTargetItem(item);
                          setShowMappingModal(true);
                        }}
                      >
                        <Link className="w-4 h-4 mr-1" />
                        Map Skill
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No items found matching your filters.
              </div>
            )}
          </div>
        )}
        
        {/* Unmapped Items View */}
        {activeView === 'mappings' && (
          <div>
            {unmappedItems.length > 0 ? (
              <div className="grid gap-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <span className="font-semibold text-yellow-700 dark:text-yellow-300">
                      {unmappedItems.length} items need skill mappings
                    </span>
                  </div>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                    These items won&apos;t appear in study plans until they&apos;re mapped to at least one skill.
                  </p>
                </div>
                
                {unmappedItems.map(item => (
                  <Card key={item.id} className="border-yellow-300 dark:border-yellow-700">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded uppercase">
                              {item.itemType}
                            </span>
                            <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded">
                              {item.format}
                            </span>
                          </div>
                          <p className="text-sm mt-2">{item.prompt}</p>
                        </div>
                        
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setMappingTargetItem(item);
                            setShowMappingModal(true);
                          }}
                        >
                          <Link className="w-4 h-4 mr-1" />
                          Add Mapping
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="font-semibold text-lg">All items are mapped!</h3>
                <p className="text-gray-500 mt-1">
                  Every practice item has at least one skill mapping.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* New Skill Modal */}
      {showNewSkillForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg m-4">
            <CardHeader>
              <CardTitle>Create New Micro-Skill</CardTitle>
              <CardDescription>
                Define a specific, testable competency
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Code</label>
                <Input
                  placeholder="e.g., cp-jurisdiction-territorial"
                  value={newSkill.code}
                  onChange={(e) => setNewSkill({ ...newSkill, code: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  placeholder="e.g., Territorial Jurisdiction"
                  value={newSkill.name}
                  onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Textarea
                  placeholder="Describe the skill..."
                  value={newSkill.description}
                  onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Unit</label>
                <select
                  value={newSkill.unitId}
                  onChange={(e) => setNewSkill({ ...newSkill, unitId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                >
                  <option value="">Select a unit...</option>
                  {units.map(unit => (
                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Exam Weight (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={newSkill.examWeight * 100}
                    onChange={(e) => setNewSkill({ ...newSkill, examWeight: parseFloat(e.target.value) / 100 })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Difficulty (1-5)</label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={newSkill.difficulty}
                    onChange={(e) => setNewSkill({ ...newSkill, difficulty: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Format Tags</label>
                <div className="flex flex-wrap gap-2">
                  {['written', 'oral', 'drafting', 'mcq'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const tags = newSkill.formatTags.includes(tag)
                          ? newSkill.formatTags.filter(t => t !== tag)
                          : [...newSkill.formatTags, tag];
                        setNewSkill({ ...newSkill, formatTags: tags });
                      }}
                      className={`px-3 py-1 rounded text-sm ${
                        newSkill.formatTags.includes(tag)
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setShowNewSkillForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={createSkill}
                  disabled={saving || !newSkill.code || !newSkill.name || !newSkill.unitId}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Skill
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Mapping Modal */}
      {showMappingModal && mappingTargetItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl m-4 max-h-[80vh] overflow-auto">
            <CardHeader>
              <CardTitle>Map Item to Skills</CardTitle>
              <CardDescription>
                Select skills that this item tests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium">Item:</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{mappingTargetItem.prompt}</p>
              </div>
              
              <div className="space-y-2">
                {skills
                  .filter(s => s.unitId === mappingTargetItem.unitId || selectedUnit === 'all')
                  .map(skill => {
                    const isLinked = mappingTargetItem.skillMappings.some(m => m.skillId === skill.id);
                    return (
                      <div
                        key={skill.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isLinked 
                            ? 'border-green-300 bg-green-50 dark:bg-green-900/20'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                              {skill.code}
                            </span>
                            <span className="font-medium">{skill.name}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{skill.description}</p>
                        </div>
                        
                        <Button
                          variant={isLinked ? 'destructive' : 'default'}
                          size="sm"
                          onClick={() => {
                            if (isLinked) {
                              removeMapping(mappingTargetItem.id, skill.id);
                            } else {
                              addMapping(mappingTargetItem.id, skill.id, 1.0);
                            }
                          }}
                          disabled={saving}
                        >
                          {isLinked ? (
                            <>
                              <Unlink className="w-4 h-4 mr-1" />
                              Unlink
                            </>
                          ) : (
                            <>
                              <Link className="w-4 h-4 mr-1" />
                              Link
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
              </div>
              
              <div className="flex justify-end mt-6">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowMappingModal(false);
                    setMappingTargetItem(null);
                  }}
                >
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Edit Skill Modal */}
      {editingSkill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg m-4">
            <CardHeader>
              <CardTitle>Edit Skill</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Code</label>
                <Input
                  value={editingSkill.code}
                  onChange={(e) => setEditingSkill({ ...editingSkill, code: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  value={editingSkill.name}
                  onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Textarea
                  value={editingSkill.description}
                  onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Exam Weight (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={editingSkill.examWeight * 100}
                    onChange={(e) => setEditingSkill({ ...editingSkill, examWeight: parseFloat(e.target.value) / 100 })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Difficulty (1-5)</label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={editingSkill.difficulty}
                    onChange={(e) => setEditingSkill({ ...editingSkill, difficulty: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingSkill.isActive}
                  onChange={(e) => setEditingSkill({ ...editingSkill, isActive: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="isActive" className="text-sm">Active</label>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={() => setEditingSkill(null)}>
                  Cancel
                </Button>
                <Button onClick={() => updateSkill(editingSkill)} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
