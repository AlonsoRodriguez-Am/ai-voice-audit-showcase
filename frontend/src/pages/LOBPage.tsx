import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import type { LOB } from '../types';
import { Plus, Search, Edit2, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LOBModal from '../components/LOBModal';

const LOBPage = ({ embedded = false }: { embedded?: boolean }) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLOB, setSelectedLOB] = useState<LOB | null>(null);

  const { data: lobs, isLoading } = useQuery<LOB[]>({
    queryKey: ['lobs'],
    queryFn: async () => {
      const response = await client.get('/api/lobs/');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<LOB>) => client.post('/api/lobs/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lobs'] });
      setIsModalOpen(false);
      toast.success('LOB created successfully');
    },
    onError: (error: any) => {
      const msg = error.response?.data?.detail || error.message;
      toast.error(`Failed to create LOB: ${msg}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<LOB> }) => client.put(`/api/lobs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lobs'] });
      setIsModalOpen(false);
      toast.success('LOB updated successfully');
    },
    onError: (error: any) => {
      const msg = error.response?.data?.detail || error.message;
      toast.error(`Failed to update LOB: ${msg}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => client.delete(`/api/lobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lobs'] });
      toast.success('LOB deleted successfully');
    },
    onError: (error: any) => {
      const msg = error.response?.data?.detail || error.message;
      toast.error(`Failed to delete LOB: ${msg}`);
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => 
      client.put(`/api/lobs/${id}`, { is_active: active }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lobs'] });
      toast.success(`LOB ${variables.active ? 'activated' : 'deactivated'} successfully`);
    },
    onError: (error: any) => {
      const msg = error.response?.data?.detail || error.message;
      toast.error(`Failed to toggle LOB: ${msg}`);
    }
  });

  const handleEdit = (lob: LOB) => {
    setSelectedLOB(lob);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setSelectedLOB(null);
    setIsModalOpen(true);
  };

  const handleSave = (data: Partial<LOB>) => {
    if (selectedLOB) {
      console.log(`DEBUG: Mutating LOB ${selectedLOB.id}:`, data);
      updateMutation.mutate({ id: selectedLOB.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredLobs = lobs?.filter(lob => 
    lob.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-family)' }} className="animate-page">
      {!embedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-1)', margin: 0, fontFamily: 'var(--font-family)' }}>Lines of Business</h1>
            <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: 0, fontFamily: 'var(--font-family)' }}>Manage Lines of Business and audit evaluation criteria rules.</p>
          </div>
          <button 
            onClick={handleAddNew}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
              background: 'linear-gradient(135deg, var(--accent), #D9BC7A)', border: 'none',
              borderRadius: 'var(--r-sm)', color: '#090C12', fontSize: 11, fontWeight: 800,
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 150ms',
              fontFamily: 'var(--font-family)'
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 16px rgba(201,169,98,0.35)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <Plus size={14} />
            Add New LOB
          </button>
        </div>
      )}

      <div className="ds-card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', maxWidth: 360, flex: 1 }}>
            <Search size={14} color="var(--tx-3)" style={{ position: 'absolute', left: 12 }} />
            <input 
              type="text"
              placeholder="Search LOBs..."
              style={{
                width: '100%', padding: '8px 12px 8px 36px', background: 'var(--bg-s2)',
                border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--tx-1)',
                fontSize: 12, outline: 'none', transition: 'all 150ms', fontFamily: 'var(--font-family)'
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-b)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {embedded && (
            <button 
              onClick={handleAddNew}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                background: 'linear-gradient(135deg, var(--accent), #D9BC7A)', border: 'none',
                borderRadius: 'var(--r-sm)', color: '#090C12', fontSize: 11, fontWeight: 800,
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 150ms',
                fontFamily: 'var(--font-family)'
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 16px rgba(201,169,98,0.35)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <Plus size={14} />
              Add New LOB
            </button>
          )}
        </div>
      </div>

      <div className="ds-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-family)' }}>
            <thead>
              <tr style={{ background: 'var(--bg-s2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 20px', fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font-family)' }}>LOB Name</th>
                <th style={{ padding: '12px 20px', fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', fontFamily: 'var(--font-family)' }}>Active Status</th>
                <th style={{ padding: '12px 20px', fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font-family)' }}>Criteria</th>
                <th style={{ padding: '12px 20px', fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right', fontFamily: 'var(--font-family)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <Loader2 className="spin-anim" color="var(--accent)" size={24} style={{ margin: '0 auto' }} />
                  </td>
                </tr>
              ) : filteredLobs?.map((lob) => (
                <tr 
                  key={lob.id} 
                  style={{ borderBottom: '1px solid var(--border)', transition: 'background 150ms' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-s2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 700, color: 'var(--tx-1)', fontSize: 13 }}>{lob.name}</span>
                      {lob.is_builtin && (
                        <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', width: 'fit-content' }}>
                          System Default
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                    <button 
                      onClick={() => toggleMutation.mutate({ id: lob.id, active: !lob.is_active })}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 'var(--r-pill)',
                        border: '1px solid',
                        borderColor: lob.is_active ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        background: lob.is_active ? 'rgba(52, 211, 153, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                        color: lob.is_active ? 'var(--green)' : 'var(--tx-3)',
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        cursor: 'pointer',
                        transition: 'all 200ms',
                        fontFamily: 'var(--font-family)'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = lob.is_active ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255, 255, 255, 0.06)';
                        e.currentTarget.style.borderColor = lob.is_active ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.1)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = lob.is_active ? 'rgba(52, 211, 153, 0.06)' : 'rgba(255, 255, 255, 0.02)';
                        e.currentTarget.style.borderColor = lob.is_active ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255, 255, 255, 0.05)';
                      }}
                    >
                      <span style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: lob.is_active ? 'var(--green)' : 'var(--tx-3)',
                        boxShadow: lob.is_active ? '0 0 6px var(--green)' : 'none',
                        transition: 'all 200ms'
                      }} />
                      {lob.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--tx-2)', fontWeight: 600, fontSize: 12 }}>
                    {Object.keys(lob.criteria_json || {}).length} rules
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button 
                        onClick={() => handleEdit(lob)}
                        disabled={lob.is_builtin}
                        title={lob.is_builtin ? "Cannot edit system LOBs" : "Edit LOB"}
                        style={{
                          background: 'none', border: 'none', padding: 6, borderRadius: 'var(--r-sm)',
                          cursor: lob.is_builtin ? 'not-allowed' : 'pointer', color: lob.is_builtin ? 'var(--tx-3)' : 'var(--tx-2)',
                          opacity: lob.is_builtin ? 0.35 : 1, transition: 'all 150ms'
                        }}
                        onMouseEnter={e => { if(!lob.is_builtin) e.currentTarget.style.color = 'var(--tx-1)'; }}
                        onMouseLeave={e => { if(!lob.is_builtin) e.currentTarget.style.color = 'var(--tx-2)'; }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete ${lob.name}?`)) {
                            deleteMutation.mutate(lob.id);
                          }
                        }}
                        disabled={lob.is_builtin || lob.is_active}
                        title={lob.is_builtin ? "Cannot delete system LOBs" : (lob.is_active ? "Deactivate first" : "Delete LOB")}
                        style={{
                          background: 'none', border: 'none', padding: 6, borderRadius: 'var(--r-sm)',
                          cursor: (lob.is_builtin || lob.is_active) ? 'not-allowed' : 'pointer',
                          color: (lob.is_builtin || lob.is_active) ? 'var(--tx-3)' : 'var(--red)',
                          opacity: (lob.is_builtin || lob.is_active) ? 0.35 : 1, transition: 'all 150ms'
                        }}
                        onMouseEnter={e => { if(!lob.is_builtin && !lob.is_active) e.currentTarget.style.color = 'var(--red)'; }}
                        onMouseLeave={e => { if(!lob.is_builtin && !lob.is_active) e.currentTarget.style.color = 'var(--red)'; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <LOBModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        lob={selectedLOB}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};

export default LOBPage;
