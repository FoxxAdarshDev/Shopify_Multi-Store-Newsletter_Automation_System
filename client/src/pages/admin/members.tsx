import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus, Settings, Trash2, Mail, Shield, CheckCircle, XCircle } from 'lucide-react';

interface Member {
  id: string;
  email: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  permissions: Record<string, boolean>;
  createdAt: string;
}

const createMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  permissions: z.record(z.boolean()).optional(),
});

type CreateMemberData = z.infer<typeof createMemberSchema>;

const AVAILABLE_PERMISSIONS = {
  'manage_stores': 'Manage Stores',
  'manage_popups': 'Manage Popups', 
  'view_subscribers': 'View Subscribers',
  'manage_subscribers': 'Manage Subscribers',
  'manage_email_settings': 'Manage Email Settings',
  'manage_integrations': 'Manage Integrations',
  'delete_data': 'Delete Stores/Data',
};

export default function Members() {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ['/api/admin/members'],
  });

  const createForm = useForm<CreateMemberData>({
    resolver: zodResolver(createMemberSchema),
    defaultValues: {
      email: '',
      permissions: {},
    },
  });

  const createMemberMutation = useMutation({
    mutationFn: async (data: CreateMemberData) => {
      return await apiRequest('/api/admin/create-member', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/members'] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: 'Member Created',
        description: 'Member invitation sent successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create member',
        variant: 'destructive',
      });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ memberId, permissions }: { memberId: string; permissions: Record<string, boolean> }) => {
      return await apiRequest(`/api/admin/members/${memberId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/members'] });
      setIsPermissionsDialogOpen(false);
      setSelectedMember(null);
      toast({
        title: 'Permissions Updated',
        description: 'Member permissions updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update permissions',
        variant: 'destructive',
      });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return await apiRequest(`/api/admin/members/${memberId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/members'] });
      toast({
        title: 'Member Deleted',
        description: 'Member deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete member',
        variant: 'destructive',
      });
    },
  });

  const onCreateSubmit = (data: CreateMemberData) => {
    createMemberMutation.mutate(data);
  };

  const handleUpdatePermissions = (permissions: Record<string, boolean>) => {
    if (!selectedMember) return;
    updatePermissionsMutation.mutate({ memberId: selectedMember.id, permissions });
  };

  const handleDeleteMember = (memberId: string) => {
    if (confirm('Are you sure you want to delete this member? This action cannot be undone.')) {
      deleteMemberMutation.mutate(memberId);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading members...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#0071b9' }} data-testid="members-title">Member Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage team members and their permissions
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-member">
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New Member</DialogTitle>
              <DialogDescription>
                Send an invitation email to a new team member. They'll receive a link to set up their password.
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="member@foxxbioprocess.com"
                          data-testid="input-member-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-3">
                  <FormLabel>Initial Permissions</FormLabel>
                  {Object.entries(AVAILABLE_PERMISSIONS).map(([key, label]) => (
                    <FormField
                      key={key}
                      control={createForm.control}
                      name={`permissions.${key}`}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                              data-testid={`checkbox-permission-${key}`}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-normal">
                              {label}
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMemberMutation.isPending}
                    data-testid="button-send-invitation"
                  >
                    {createMemberMutation.isPending ? 'Sending...' : 'Send Invitation'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {members.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <UserPlus className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No members yet</h3>
                <p className="text-muted-foreground mb-4">
                  Invite team members to collaborate on the newsletter dashboard.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite First Member
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          members.map((member) => (
            <Card key={member.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div>
                      <CardTitle className="text-base" data-testid={`member-email-${member.id}`}>
                        {member.email}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <span>
                          Joined {new Date(member.createdAt).toLocaleDateString()}
                        </span>
                        {member.lastLoginAt && (
                          <span>
                            • Last login {new Date(member.lastLoginAt).toLocaleDateString()}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {member.isActive ? (
                      <Badge variant="default" data-testid={`status-active-${member.id}`}>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" data-testid={`status-inactive-${member.id}`}>
                        <XCircle className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                    
                    {member.isEmailVerified ? (
                      <Badge variant="outline">
                        <Mail className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Mail className="w-3 h-3 mr-1" />
                        Unverified
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Permissions:</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(member.permissions).filter(([, enabled]) => enabled).length === 0 ? (
                        <Badge variant="outline" className="text-xs">No permissions</Badge>
                      ) : (
                        Object.entries(member.permissions)
                          .filter(([, enabled]) => enabled)
                          .map(([permission]) => (
                            <Badge key={permission} variant="outline" className="text-xs">
                              {AVAILABLE_PERMISSIONS[permission as keyof typeof AVAILABLE_PERMISSIONS] || permission}
                            </Badge>
                          ))
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedMember(member);
                        setIsPermissionsDialogOpen(true);
                      }}
                      data-testid={`button-edit-permissions-${member.id}`}
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      Permissions
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteMember(member.id)}
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      data-testid={`button-delete-member-${member.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Permissions Dialog */}
      <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Permissions</DialogTitle>
            <DialogDescription>
              Manage permissions for {selectedMember?.email}
            </DialogDescription>
          </DialogHeader>
          
          {selectedMember && (
            <div className="space-y-4">
              {Object.entries(AVAILABLE_PERMISSIONS).map(([key, label]) => (
                <div key={key} className="flex items-center space-x-3">
                  <Checkbox
                    id={`perm-${key}`}
                    checked={selectedMember.permissions[key] || false}
                    onCheckedChange={(checked) => {
                      setSelectedMember({
                        ...selectedMember,
                        permissions: {
                          ...selectedMember.permissions,
                          [key]: !!checked,
                        },
                      });
                    }}
                    data-testid={`checkbox-edit-permission-${key}`}
                  />
                  <label htmlFor={`perm-${key}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {label}
                  </label>
                </div>
              ))}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsPermissionsDialogOpen(false)}
                  data-testid="button-cancel-permissions"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleUpdatePermissions(selectedMember.permissions)}
                  disabled={updatePermissionsMutation.isPending}
                  data-testid="button-save-permissions"
                >
                  {updatePermissionsMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}